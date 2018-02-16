// /* Bus Stop Timetable Widget for ACP Lobby Screen */

/* globals RTMONITOR_API, DEBUG, moment */
/* exported StopTimetable */

function StopTimetable(container, params) {

    'use strict';

    var self = this;

    // Symbolic constants

    var SECONDS = 1000;

    // Configuration constants

    var TIMETABLE_URI = 'http://tfc-app3.cl.cam.ac.uk/transport/api',
        DISPLAY_REFRESH_INTERVAL = 30 * SECONDS,
        SUBSCRIPTION_REFRESH_INTERVAL = 60 * SECONDS,
        MAX_LINES = 50,                            // Maximum number of departures to show
        JOURNEY_BATCH_SIZE = 20;                   // Journeys to retrieve in one batch

   // Global state

    var departure_div,        // DOM id of the <div> that contains departure information
        display_timer_id,     // The ID of the timer that will eventually update the display
        subscription_timer_id,// The ID of the timer that will eventually refresh the subscriptions
        journey_table = [],   // Master table of today's journeys - top-level keys
                              //     timetable: TNDS timetable entry from API
                              //       origin: atcocode of origin stop
                              //       departure: moment() of timetabled departure tine
                              //       due: moment() of time at this stop
                              //     rt: most recent real time report for this journey
                              //       rt_timestamp: moment() of last rt record receipt
                              //       delay: most recent Delay as moment.duration()
                              //       eta: moment() of current best  guess time at this stop
        journey_index = {};   // Index into journay_table by origin + departure time

    // Here we define the 'data record format' of the incoming websocket feed
    //this.RECORD_INDEX = 'VehicleRef';  // data record property that is primary key
    //this.RECORDS_ARRAY = 'request_data'; // incoming socket data property containing data records
    //this.RECORD_TS = 'RecordedAtTime'; // data record property containing timestamp
    //this.RECORD_TS_FORMAT = 'ISO8601'; // data record timestamp format
                                       // 'ISO8601' = iso-format string
    //this.RECORD_LAT = 'Latitude';      // name of property containing latitude
    //this.RECORD_LNG = 'Longitude';     // name of property containing longitude
    //this.RECORD_ORIGIN_STOP_ID = 'OriginRef'; // SiriVM origin stop_id
    //this.RECORD_ORIGIN_TIME = 'OriginAimedDepartureTime'; // SiriVM origin timetable departure time
    //this.RECORD_DELAY = 'Delay'; // SiriVM 'XML Duration' delay value e.g. "PT2M8S"

    //this.refresh_timer = {};

    //this.stops_cache = {}; // store the stops we collect from the journeys through the current stop

    //this.rtmonitor_subscriptions = {}; // Dictionary of SiriVM subscriptions indexed on <stop>_<time>

    this.init = function() {

        log('Running StopTimetable.init', container);

        // Register handlers for connect/disconnect
        RTMONITOR_API.ondisconnect(this, this.rtmonitor_disconnected);
        RTMONITOR_API.onconnect(this, this.rtmonitor_connected);

        // Set up the HTML skeleton of the container
        initialise_container(container);

        // Populate the journey table. As a side effect, this updates
        // the display, starts the refresh timer and subscribes to
        // real-time updates
        populate_journeys();

    };

    function initialise_container(id) {

        var container = document.getElementById(id);

        // Empty the 'container' div (i.e. remove loading GIF)
        empty(container);

        // Write HTML into 'container' div:
        //
        // <div class="stop_timetable">
        //   <div class="content_area">
        //     <h1>Title</h1>
        //     <div class="stop_timetable_connection_div" id="<container?_connection"
        //       Connection issues
        //     </div>
        //     <div class="departures">
        //       ...
        //     </div>
        //   </div>
        // </div>


        // <div id="<container>_title_div">
        //   <div id="<container>_title_text>TITLE HERE (params.title)</div>
        // </div>
        //<div id="<container>_map">MAP WILL GO HERE</div>
        //

        var stop_timetable = document.createElement('div');
        stop_timetable.setAttribute('class', 'stop_timetable');
        container.appendChild(stop_timetable);

        var content_area = document.createElement('div');
        content_area.setAttribute('class', 'content_area');
        stop_timetable.appendChild(content_area);

        var title = document.createElement('h1');
        title.innerHTML = params.common_name;
        content_area.appendChild(title);

        var connection_div = document.createElement('div');
        connection_div.setAttribute('class','stop_timetable_connection_div');
        connection_div.setAttribute('id', id + '_connection');
        connection_div.innerHTML = 'Connection issues';
        container.appendChild(connection_div);

        departure_div = document.createElement('div');
        content_area.appendChild(departure_div);
    }


    function populate_journeys() {
        // Reset journey_table and populate it with today's journeys

        // Cancel any outstanding subscriptions
        for (var i = 0; i < journey_table.length; i++) {
            var journey = journey_table[i];
            if (journey.rtsub) {
                log('populate_journeys - unsubscribing', journey.rtsub);
                RTMONITOR_API.unsubscribe(journey.rtsub);
            }
        }

        journey_table = [];
        journey_index = [];

        get_journey_batch(0);

    }


    function get_journey_batch(iteration) {
        // Trigger retrieval of a batch of journey records

        log('get_journey_batch - iteration', iteration);
        if (iteration > 100) {
            throw 'Excessive recursion in get_journey_batch';
        }

        // Start from 30 minutes ago if the table is empty,
        // or at the departure_time of the last entry
        var start_time;
        if (journey_table.length === 0) {
            start_time = moment().subtract(30, 'seconds').format('HH:mm:ss');
        }
        else {
            var last_journey = journey_table[journey_table.length - 1];
            start_time = last_journey.timetable.time;
        }
        log('get_journey_batch - start_time:', start_time);

        var qs = '?stop_id='+encodeURIComponent(params.stop_id);
        qs += '&datetime_from='+encodeURIComponent(start_time);
        qs += '&expand_journey=true';
        qs += '&nresults='+encodeURIComponent(JOURNEY_BATCH_SIZE);

        var uri = TIMETABLE_URI + '/journeys_by_time_and_stop/' + qs;
        log('get_journey_batch - fetching', uri);

        var xhr = new XMLHttpRequest();
        xhr.open('GET', uri, true);
        xhr.send();
        xhr.onreadystatechange = function() {
            if(xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
                //log(xhr.responseText);
                var api_result = JSON.parse(xhr.responseText);
                var added = add_journeys(iteration,api_result);
                // If we added at least one new record then update the
                // display and recurse to get more
                if (added) {
                    refresh_display();
                    refresh_subscriptions();
                    get_journey_batch(++iteration);
                }
            }
        };

    }


    function add_journeys(iteration,data) {
        // Add new journeys to journey_table. Return the number of
        // records actually added

        log('add_journeys - got', data.results.length, 'results');

        var added = 0;

        for (var i = 0; i < data.results.length; i++) {
            var result = data.results[i];
            var origin_stop = result.journey.timetable[0].stop.atco_code;
            var departure_time_str = result.journey.departure_time;

            // Have we seen it before?
            if (journey_index.hasOwnProperty(origin_stop + '!' + departure_time_str)) {
                log('add_journeys - skipping', origin_stop + '!' + departure_time_str, result.time);
                continue;
            }

            log('add_journeys - adding', origin_stop + '!' + departure_time_str, result.time);
            added++;

            var entry = {
                timetable: result,
                origin: origin_stop,
                departure: time_to_moment(departure_time_str),
                due: time_to_moment(result.time),
                eta: time_to_moment(result.time),
                rt: {}
            };

            journey_index[origin_stop + '!' + departure_time_str] = entry;
            journey_table.push(entry);

        }

        log('add_journeys - actually added', added, 'journeys');

        return added;

    }


    function refresh_subscriptions() {
        // Walk journey_table, subscribe to real time updates for
        // journeys with due time within a window of now,
        // and unsubscribe for journeys outside these limits

        log('refresh_subscriptions - running');

        // Cancel the update timer if it's running
        if (subscription_timer_id) {
            window.clearTimeout(subscription_timer_id);
        }

        // Run this in try...finally to ensure the timer is reset
        try {

            for (var i = 0; i < journey_table.length; i++) {
                var entry = journey_table[i];

                log(entry.due.format('HH:mm:ss'));
                log(entry.due.isBefore(moment().subtract(30, 'minutes')));
                log(moment().add(60, 'minutes').format('HH:mm:ss'));
                log(entry.due.isAfter(moment().add(60, 'minutes')));

                if ( (entry.due.isBefore(moment().subtract(30, 'minutes')) ||
                      entry.due.isAfter(moment().add(60, 'minutes'))) ) {

                    log('refresh_subscriptions - outside window');
                    if (entry.rtsub) {
                        log('refresh_subscriptions - unsubscribing', entry.rtsub, entry.due);
                        RTMONITOR_API.unsubscribe(entry.rtsub);
                        entry.rtsub = undefined;
                    }
                    else {
                        log('refresh_subscriptions - not subscribed anyway');
                    }
                }

                else {

                    log('refresh_subscriptions - inside window');
                    if (!entry.rtsub) {
                        log('refresh_subscriptions - subscribing', entry.origin + '!' + entry.departure.format('HH:mm:ss'), entry.due.format('HH:mm:ss'));
                        entry.rtsub = subscribe(entry.origin, entry.departure);
                    }
                    else {
                        log('refresh_subscriptions - alreday subscribed');
                    }

                }

            }
        }
        finally {
            // Restart the update timer to eventually re-refresh the page
            subscription_timer_id = window.setTimeout(refresh_subscriptions, SUBSCRIPTION_REFRESH_INTERVAL);
        }
    }


    function refresh_display() {
        // Update (actually recreate and replace) the display by
        // walking the journey_table

        //log('refresh_display - running');

        // Cancel the update timer if it's running
        if (display_timer_id) {
            window.clearTimeout(display_timer_id);
        }

        // Run this in try...finally to ensure the timer is reset
        try {

            var result;
            switch (params.layout) {
                case 'debug':
                    result = display_debug();
                    break;
                default:
                    if (params.layout !== 'simple') {
                        log('refresh_display - unexpected layout', params.layout, 'using \'simple\'');
                    }
                    result = display_simple();
            }

            empty(departure_div);
            if (result) {
                departure_div.appendChild(result);
            }

        }
        finally {
            // Restart the update timer to eventually re-refresh the page
            display_timer_id = window.setTimeout(refresh_display,DISPLAY_REFRESH_INTERVAL);
        }
    }


    function display_simple() {
        // Basic departure board layout

        var table = document.createElement('table');

        var heading = document.createElement('tr');

        var th1 = document.createElement('th');
        th1.innerHTML = 'Time';
        var th2 = document.createElement('th');
        th2.innerHTML = 'Route';
        var th3 = document.createElement('th');
        th3.innerHTML = 'Expected';

        heading.appendChild(th1);
        heading.appendChild(th2);
        heading.appendChild(th3);
        table.appendChild(heading);

        var nrows = 0;

        for (var i=0; i<journey_table.length; i++) {
            var entry = journey_table[i];

            // Skip anything that left in the past
            if (entry.eta.isBefore(moment().subtract(5, 'minutes'))) {
                continue;
            }

            nrows++;

            var journey_timetable = entry.timetable.journey.timetable;
            var last_stop = journey_timetable[journey_timetable.length-1].stop.common_name;

            var row = document.createElement('tr');

            var td1 = document.createElement('td');
            td1.innerHTML = entry.due.format('HH:mm');

            // Line name and final stop
            var td2 = document.createElement('td');
            td2.innerHTML = entry.timetable.line.line_name + ' (' + last_stop + ')';

            // ETA, providing most recent RT record in the last minute
            var td3 = document.createElement('td');
            if (entry.rt_timestamp &&
                (entry.rt_timestamp.isAfter(moment().subtract(60, 'seconds')))) {
                td3.innerHTML = entry.eta.format('HH:mm');
            }
            else {
                td3.innerHTML = '';
            }

            row.appendChild(td1);
            row.appendChild(td2);
            row.appendChild(td3);
            table.appendChild(row);

            // No point adding more than MAX_LINES rows because they will be
            // off the bottom of the display
            if (nrows >= MAX_LINES) {
                break;
            }

        }

        if (nrows === 0) {
            var div = document.createElement('div');
            div.setAttribute('class','no-departures');
            div.innerHTML = 'No more departures today';
            return div;
        }

        return table;

    }

    function display_debug() {
        // Debug display board with internal data

        var table = document.createElement('table');

        var heading = document.createElement('tr');

        var thx = document.createElement('th');
        thx.innerHTML = 'OriginRef';
        var thy = document.createElement('th');
        thy.innerHTML = 'Dep';
        var th1 = document.createElement('th');
        th1.innerHTML = 'Time';
        var th2 = document.createElement('th');
        th2.innerHTML = 'Route';
        var th3 = document.createElement('th');
        th3.innerHTML = 'Expected';
        var th4 = document.createElement('th');
        th4.innerHTML = 'Seen';
        var th5 = document.createElement('th');
        th5.innerHTML = 'Delay';

        heading.appendChild(thx);
        heading.appendChild(thy);
        heading.appendChild(th1);
        heading.appendChild(th2);
        heading.appendChild(th3);
        heading.appendChild(th4);
        heading.appendChild(th5);
        table.appendChild(heading);

        var nrows = 0;

        for (var i=0; i<journey_table.length; i++) {
            var entry = journey_table[i];

            // Skip anything that left in the past
            if (entry.eta.isBefore(moment().subtract(5, 'minutes'))) {
                continue;
            }

            nrows++;

            var journey_timetable = entry.timetable.journey.timetable;
            var last_stop = journey_timetable[journey_timetable.length-1].stop.common_name;

            var row = document.createElement('tr');

            var tdx = document.createElement('td');
            tdx.innerHTML = entry.origin;

            var tdy = document.createElement('td');
            tdy.innerHTML = entry.departure.format('HH:mm');

            var td1 = document.createElement('td');
            td1.innerHTML = entry.due.format('HH:mm');

            // Line name and final stop
            var td2 = document.createElement('td');
            td2.innerHTML = entry.timetable.line.line_name + ' (' + last_stop + ')';

            // ETA, providing most recent RT record in the last minute
            var td3 = document.createElement('td');
            if (entry.rt_timestamp &&
                (entry.rt_timestamp.isAfter(moment().subtract(60, 'seconds')))) {
                td3.innerHTML = entry.eta.format('HH:mm');
            }
            else {
                td3.innerHTML = '';
            }

            // Most recent rt_timestamp (if we have one)
            var td4 = document.createElement('td');
            if (entry.rt_timestamp) {
                //log(entry.rt.received_timestamp);
                td4.innerHTML = entry.rt_timestamp.format('HH:mm');
            }
            else {
                td4.innerHTML = '';
            }

            // Current delay
            var td5 = document.createElement('td');
            if (entry.delay) {
                td5.innerHTML = entry.delay.toISOString();
            }
            else {
                td5.innerHTML = '';
            }

            row.appendChild(tdx);
            row.appendChild(tdy);
            row.appendChild(td1);
            row.appendChild(td2);
            row.appendChild(td3);
            row.appendChild(td4);
            row.appendChild(td5);
            table.appendChild(row);

            // No point adding more than MAX_LINES rows because they will be
            // off the bottom of the display
            if (nrows >= MAX_LINES) {
                break;
            }

        }

        if (nrows === 0) {
            var div = document.createElement('div');
            div.setAttribute('class','no-departures');
            div.innerHTML = 'No more departures today';
            return div;
        }

        return table;

    }


    //==== RT Monitor interface ========================================

    this.rtmonitor_disconnected = function() {
        // this function will be called by RTMonitorAPI if it DISCONNECTS from server
        log('stop_timetable rtmonitor_disconnected');
        document.getElementById(container+'_connection').style.display = 'inline-block';
    };

    this.rtmonitor_connected = function() {
        // this function will be called by RTMonitorAPI each time it has CONNECTED to server
        log('stop_timetable rtmonitor_connected');
        document.getElementById(container+'_connection').style.display = 'none';
    };


    function subscribe(stop_id, time) {
        // call 'subscribe' for RT messages matching stop_id and (departure) time
        var request_id = container+'_'+stop_id+'_'+time.format('HH:mm:ss');
        //log('subscribe - processing for', request_id);

        var request_msg = JSON.stringify(
            {
                msg_type: 'rt_subscribe',
                request_id: request_id,
                filters:
                    [
                        {
                            test: '=',
                            key: 'OriginRef',
                            value: stop_id
                        },
                        {
                            test: '=',
                            key: 'OriginAimedDepartureTime',
                            value: time.format('YYYY-MM-DDTHH:mm:ssZ')
                        }
                    ]
            }
        );

        log(request_msg);

        var request_status = RTMONITOR_API.request(self, request_id, request_msg, self.handle_message);

        if (request_status.status !== 'rt_ok') {
            log('subscribe failed ', JSON.stringify(request_status));
            return undefined;
        }

        log('subscribe - subscribed ok for', request_id);

        return request_id;

    }


    this.handle_message = function(incoming_data) {
        // Process incoming Web Socket messages
        //log('handle_records - incoming data with', incoming_data.request_data.length, 'records');

        for (var i = 0; i < incoming_data.request_data.length; i++) {
            var msg = incoming_data.request_data[i];

            var origin = msg.OriginRef;
            var departure_time = moment(msg.OriginAimedDepartureTime);
            var delay = moment.duration(msg.Delay);
            var key = origin + '!' + departure_time.format('HH:mm:ss');
            log('handle_records - key', key);

            if (journey_index.hasOwnProperty(key)) {
                journey_index[key].rt = msg;
                journey_index[key].rt_timestamp = moment();
                journey_index[key].delay = delay;
                journey_index[key].eta = journey_index[key].due.clone().add(delay);
            }
            else {
                log('handle_records - message', key, 'no match');
            }
        }

        // Refresh the display to allow for any changes
        refresh_display();

    };

    //==== Utilities ===================================================


    function log() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('stop_timetable_log') >= 0) {
            console.log.apply(console, arguments);
        }
    }

    function empty(element) {
        // Delete the content of the DOM element `element`
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    function time_to_moment(time) {
        // Expand a localtime time into a full Date object based on today
        var result = moment();
        result.hours(time.slice(0,2));
        result.minutes(time.slice(3,5));
        result.seconds(time.slice(6,8));
        result.milliseconds(0);
        return result;
    }

    log('Instantiated StopTimetable', container, params);

    // END of 'class' StopTimetable

}

// ***************************************************************************
// *******************  Transport API     ************************************
// **********************************i****************************************
//


/*
















/

// ********************************************************************************
// ***********  Process the data records arrived from WebSocket or Replay *********
// ********************************************************************************







// ***********************************************************
// Pretty print an XML duration
// Convert '-PT1H2M33S' to '-1:02:33'
this.xml_duration_to_string = function(xml)
{
    var seconds = this.xml_duration_to_seconds(xml);

    var sign = (seconds < 0) ? '-' : '+';

    seconds = Math.abs(seconds);

    if (seconds < 60)
    {
        return sign + seconds + 's';
    }

    var minutes = Math.floor(seconds / 60);

    var remainder_seconds = ('0' + (seconds - minutes * 60)).slice(-2);

    if (minutes < 60)
    {
        return sign + minutes + ':' + remainder_seconds;
    }

    var hours = Math.floor(minutes / 60);

    var remainder_minutes = ('0' + (minutes - hours * 60)).slice(-2);

    return sign + hours + ':' + remainder_minutes + ':' + remainder_seconds;
}

// Parse an XML duration like '-PT1H2M33S' (minus 1:02:33) into seconds
this.xml_duration_to_seconds = function(xml)
{
    if (!xml || xml == '')
    {
        return 0;
    }
    var sign = 1;
    if (xml.slice(0,1) == '-')
    {
        sign = -1;
    }
    var hours = this.get_xml_digits(xml,'H');
    var minutes = this.get_xml_digits(xml,'M');
    var seconds = this.get_xml_digits(xml,'S');

    return sign * (hours * 3600 + minutes * 60 + seconds);
}

// Given '-PT1H2M33S' and 'S', return 33
this.get_xml_digits = function(xml, units)
{
    var end = xml.indexOf(units);
    if (end < 0)
    {
        return 0;
    }
    var start = end - 1;
    // slide 'start' backwards until it points to non-digit
    while (/[0-9]/.test(xml.slice(start, start+1)))
    {
        start--;
    }

    return Number(xml.slice(start+1,end));
}





*/

/*

{
    "results": [
        {
            "time": "00:15:00",
            "line": {
                "id": "20-8-A-y08-1",
                "line_name": "8|Citi",
                "description": "Cambridge - Impington - Histon - Cottenham",
                "standard_origin": "Emmanuel Street",
                "standard_destination": "Grays Lane",
                "operator": {
                    "id": "OId_SCCM",
                    "code": "SCCM",
                    "short_name": "Stagecoach in Cambridge",
                    "trading_name": "Stagecoach in Cambridge"
                }
            },
            "journey": {
                "id": "ea-20-8-A-y08-1-108-T0",
                "timetable": [
                    {
                        "order": 1,
                        "stop": {
                            "id": "0500CCITY487",
                            "atco_code": "0500CCITY487",
                            "naptan_code": "CMBGJPWM",
                            "common_name": "Emmanuel Street",
                            "indicator": "Stop E1",
                            "locality_name": "Cambridge",
                            "longitude": 0.12354433655,
                            "latitude": 52.204254599
                        },
                        "time": "00:15:00"
                    },
                    ...
                    {
                        "order": 36,
                        "stop": {
                            "id": "0500SCOTT025",
                            "atco_code": "0500SCOTT025",
                            "naptan_code": "CMBDWATD",
                            "common_name": "Telegraph Street",
                            "indicator": "opp",
                            "locality_name": "Cottenham",
                            "longitude": 0.12808762701,
                            "latitude": 52.2858098724
                        },
                        "time": "00:48:00"
                    }
                ],
                "departure_time": "00:15:00",
                "days_of_week": "Tuesday Wednesday Thursday Friday",
                "direction": "outbound",
                "route_description": "Emmanuel Street - Telegraph Street",
                "line": {
                    "id": "20-8-A-y08-1",
                    "line_name": "8|Citi",
                    "description": "Cambridge - Impington - Histon - Cottenham",
                    "standard_origin": "Emmanuel Street",
                    "standard_destination": "Grays Lane",
                    "operator": {
                        "id": "OId_SCCM",
                        "code": "SCCM",
                        "short_name": "Stagecoach in Cambridge",
                        "trading_name": "Stagecoach in Cambridge"
                    }
                }
            }
        }
    ]
}

*/
