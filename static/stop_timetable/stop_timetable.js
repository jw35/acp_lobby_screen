// /* Bus Stop Timetable Widget for ACP Lobby Screen */

/* globals RTMONITOR_API, DEBUG, moment */
/* exported StopTimetable */

function StopTimetable(config, params) {

    'use strict';

    // Backwards compatibility or first argument
    var container;
    if (typeof(config) === 'string') {
        container = config;
    }
    else {
        this.config = config;
        container = config.container;
    }
    this.container = container;
    this.params = params;

    // Symbolic constants

    var SECONDS = 1000,

    // Configuration constants

        // Endpoint for the timetable API
        TIMETABLE_URI                 = 'http://tfc-app3.cl.cam.ac.uk/transport/api',
        // Maximum refresh interval for the display
        DISPLAY_REFRESH_INTERVAL      = 30 * SECONDS,
        // MAximum refresh interval for real-time subscriptions
        SUBSCRIPTION_REFRESH_INTERVAL = 60 * SECONDS,
        // Maximum number of departures to add to the table
        MAX_LINES                     = 50,
        // Number of timetable journeys to retrieve in one batch
        JOURNEY_BATCH_SIZE            = 20,
        // The time zone of raw times in the timetable API
        TIMETABLE_TIMEZONE            = 'Europe/London',
        // The time zone needed for real time subscription requests
        REALTIME_TIMEZONE             = 'Europe/London',

   // Global state

        // DOM id of the <div> that contains departure information
        departure_div,
        // The ID of the timer that will eventually update the display
        display_timer_id,
        // The ID of the timer that will eventually refresh the subscriptions
        subscription_timer_id,
        // Master table of today's journeys - top-level keys
        //     timetable: TNDS timetable entry from API
        //       origin: stop object of origin stop
        //       destination: stop object of destination stop
        //       destinations: list of first timetable entry for each of
        //                                          params.destinations
        //       departure: moment() of timetabled departure tine
        //       arrival: moment() of timetabled arrival at last stop
        //       due: moment() of time at this stop
        //     rt: most recent real time report for this journey
        //       rt_timestamp: moment() of last rt record receipt
        //       delay: moment.duration() of the most recent Delay
        //       eta: moment() of current best  guess time at this stop
        //       vehicle: id of the vehicle doing the journey
        journey_table = [],
        // Index into journay_table by origin + departure time
        journey_index = {}
    ;


    // ==== Initialisation/startup functions ===========================

    this.init = function() {

        log('Running StopTimetable.init', container);

        // Register handlers for connect/disconnect
        RTMONITOR_API.ondisconnect(rtmonitor_disconnected);
        RTMONITOR_API.onconnect(rtmonitor_connected);

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
        var img = document.createElement('img');
        img.setAttribute('src', config.static_url + 'bus.png');
        title.appendChild(img);
        title.appendChild(document.createTextNode(' '));
        title.appendChild(document.createTextNode(params.common_name));
        content_area.appendChild(title);

        var connection_div = document.createElement('div');
        connection_div.setAttribute('class','widget_error');
        connection_div.setAttribute('id', id + '_connection');
        connection_div.innerHTML = 'Connection issues';
        container.appendChild(connection_div);

        departure_div = document.createElement('div');
        content_area.appendChild(departure_div);
    }


    // ==== Timetable API functions ====================================

    function populate_journeys() {
        // Reset journey_table, populate it with today's journeys, and
        // schedule ourself to run again early tomorrow morning
        try {

            // This shouldn't happen
            // Cancel any outstanding subscriptions
            for (var i = 0; i < journey_table.length; i++) {
                var journey = journey_table[i];
                if (journey.rtsub) {
                    log('populate_journeys - un-subscribing', journey.rtsub);
                    RTMONITOR_API.unsubscribe(journey.rtsub);
                }
            }

            journey_table = [];
            journey_index = [];

            get_journey_batch(0);

        }
        finally {
            // Tomorrow morning, sometime between 04:00:00 and 04:14:59.9999
            // NB: populate_journeys takes note of offset. Don't run it
            // at a time when the maximum offset (currently +/- 120 min)
            // could end up calculating the wrong day! So not earlier
            // than 02:00 or later than 22:00
            var minutes = Math.random()*15;
            var tomorrow = moment().add(1, 'd').hour(4).minute(minutes);
            var delta = tomorrow.toDate() - moment().toDate();
            console.log('Scheduling next populate_journeys for', tomorrow.format());
            window.setTimeout(populate_journeys, delta);
        }

    }


    function get_journey_batch(iteration) {
        // Trigger retrieval of a batch of journey records

        log('get_journey_batch - iteration', iteration);
        // This shouldn't happen
        if (iteration > 100) {
            log('Excessive recursion in get_journey_batch');
            return;
        }

        // Start from 30 minutes ago if the table is empty,
        // or at the departure_time of the last entry
        var start_time;
        if (journey_table.length === 0) {
            start_time = get_now().tz(TIMETABLE_TIMEZONE)
                                 .subtract(30, 'm').format('HH:mm:ss');
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
                var api_result = JSON.parse(xhr.responseText);
                var added = add_journeys(iteration,api_result);
                // If we added at least one new record then update the
                // display and our subscriptions and recurse to get more
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
            var origin_stop = result.journey.timetable[0].stop;
            var destination_stop = result.journey.timetable[result.journey.timetable.length-1].stop;
            var departure_time_str = result.journey.departure_time;
            var arrival_time_str = result.journey.timetable[result.journey.timetable.length-1].time;

            var journey_key = origin_stop.atco_code + '!' + departure_time_str;

            // Have we seen it before?
            if (journey_index.hasOwnProperty(journey_key)) {
                log('add_journeys - skipping', journey_key, result.time);
                continue;
            }

            log('add_journeys - adding', journey_key, result.time);
            added++;

            // See if this journey goes to any of our destinations
            var destination_table = [];
            // For each destination (if we have any)
            if (params.destinations) {
                for (var d = 0; d < params.destinations.length; d++) {
                    var destination = params.destinations[d];
                    // For every timetable entry on this journey
                    for (var e = 0; e < result.journey.timetable.length; e++) {
                        entry = result.journey.timetable[e];
                        // Does it go to this destination?
                        if (destination.stop_ids.indexOf(entry.stop.atco_code) !== -1) {
                            destination_table[d] = entry;
                            break;
                        }
                    }
                }
            }

            // Populate the journey_table entry
            var entry = {
                timetable: result,
                origin: origin_stop,
                destination: destination_stop,
                destinations: destination_table,
                departure: timetable_time_to_moment(departure_time_str),
                arrival: timetable_time_to_moment(arrival_time_str),
                due: timetable_time_to_moment(result.time),
                eta: timetable_time_to_moment(result.time),
                rt: {}
            };

            journey_index[journey_key] = entry;
            journey_table.push(entry);

        }

        log('add_journeys - actually added', added, 'journeys');

        return added;

    }


    // ==== Real-time subscription functions ===========================

    function rtmonitor_disconnected() {
        // this function is called by RTMonitorAPI if it DISCONNECTS from server
        log('stop_timetable rtmonitor_disconnected');
        document.getElementById(container+'_connection').style.display = 'inline-block';
        // Drop our record of the subscriptions that just evaporated
        for (var i = 0; i < journey_table.length; i++) {
            var entry = journey_table[i];
            entry.rtsub = undefined;
        }
    }


    function rtmonitor_connected() {
        // this function is called by RTMonitorAPI each time it has CONNECTED to server
        log('stop_timetable rtmonitor_connected');
        document.getElementById(container+'_connection').style.display = 'none';
        // Re-establish all the subscriptions that we need
        refresh_subscriptions();
    }


    function refresh_subscriptions() {
        // Walk journey_table, subscribe to real time updates for
        // journeys with due time within a window of (now + offset),
        // and un-subscribe for journeys outside these limits

        var now = get_now();

        log('refresh_subscriptions - running for', now.toISOString());

        // Cancel the update timer if it's running
        if (subscription_timer_id) {
            window.clearTimeout(subscription_timer_id);
        }

        // Run this in try...finally to ensure the timer is reset
        try {

            for (var i = 0; i < journey_table.length; i++) {
                var entry = journey_table[i];

                if ( (entry.due.isBefore(now.subtract(30, 'minutes')) ||
                      entry.due.isAfter(now.add(60, 'minutes'))) ) {

                    if (entry.rtsub) {
                        log('refresh_subscriptions - unsubscribing', entry.rtsub);
                        RTMONITOR_API.unsubscribe(entry.rtsub);
                        entry.rtsub = undefined;
                    }

                }
                else {

                    if (!entry.rtsub) {
                        entry.rtsub = subscribe(entry.origin.atco_code, entry.departure);
                    }

                }

            }
        }
        finally {
            // Restart the update timer to eventually re-refresh the page
            subscription_timer_id = window.setTimeout(refresh_subscriptions, SUBSCRIPTION_REFRESH_INTERVAL);
        }
    }


    function subscribe(stop_id, time) {
        // call 'subscribe' for RT messages matching stop_id and (departure) time

        var timetable_time = time.clone().tz(TIMETABLE_TIMEZONE);
        var realtime_time = time.clone().tz(REALTIME_TIMEZONE);
        var request_id = stop_id+'_'+timetable_time.format('HH:mm:ss');
        log('subscribe - caller '+container+' subscribing to', request_id);

        var request_obj = {
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
                            value: realtime_time.format('YYYY[-]MM[-]DDTHH[:]mm[:]ssZ')
                        }
                    ]
            };

        var request_status = RTMONITOR_API.subscribe(container, request_id, request_obj, handle_message);

        if (request_status.status !== 'rt_ok') {
            log('subscribe failed ', JSON.stringify(request_status));
            return undefined;
        }

        return request_id;

    }


    function handle_message(incoming_data) {
        // Process incoming Web Socket messages

        for (var i = 0; i < incoming_data.request_data.length; i++) {
            var msg = incoming_data.request_data[i];

            var origin = msg.OriginRef;
            var departure_time_str = moment(msg.OriginAimedDepartureTime).tz(TIMETABLE_TIMEZONE).format('HH:mm:ss');
            var key = origin + '!' + departure_time_str;

            if (journey_index.hasOwnProperty(key)) {
                var due = journey_index[key].due;
                var delay = moment.duration(msg.Delay);
                journey_index[key].rt = msg;
                journey_index[key].rt_timestamp = moment();
                journey_index[key].delay = delay;
                journey_index[key].eta = due.clone().add(delay);
                journey_index[key].vehicle = msg.VehicleRef;
            }
            else {
                /// This shouldn't happen
                log('handle_records - message', key, 'no match');
            }
        }

        // Refresh the display to allow for any changes
        refresh_display();

    }

    // ==== Display management =========================================

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
                case 'nextbus':
                    result = display_nextbus();
                    break;
                default:
                    if (params.layout !== 'simple') {
                        log('refresh_display - unexpected layout', params.layout, 'using \'simple\'');
                    }
                    result = display_simple();
            }

            empty(departure_div);
            if (result) {
                var updated = document.createElement('div');
                updated.classList.add('timestamp');
                updated.innerHTML = 'Updated ' + moment().format('HH:mm');
                departure_div.append(updated);
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

        //log('display_simple - running');

        var table = document.createElement('table');
        var heading = document.createElement('tr');
        var cell;

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.innerHTML = 'Due';
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.innerHTML = 'Expected';
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.innerHTML = 'Route';
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.innerHTML = 'Destination';
        heading.appendChild(cell);

        table.appendChild(heading);

        var nrows = 0;

        for (var i=0; i<journey_table.length; i++) {
            var entry = journey_table[i];

            // Skip anything that left in the past
            if (entry.eta.isBefore(get_now().subtract(1, 'minutes'))) {
                continue;
            }

            nrows++;

            var last_stop = describe_stop(entry.destination);

            var row = document.createElement('tr');
            // Flag the row for buses currently over 5 minutes late
            var thresh = entry.due.clone().add(5, 'm');
            if (fresh_timestamp(entry) && entry.eta.isAfter(thresh)) {
                 row.classList.add('issue');
            }

            cell = document.createElement('td');
            cell.classList.add('time');
            cell.innerHTML = entry.due.format('HH:mm');
            row.appendChild(cell);

            // ETA, providing most recent RT record in the last minute
            cell = document.createElement('td');
            cell.classList.add('time');
            if (fresh_timestamp(entry)) {
                if (entry.delay.asMinutes() <= 1.0) {
                    cell.innerHTML = 'On time';
                }
                else {
                    cell.innerHTML = entry.eta.format('HH:mm');
                }
            }
            else {
                cell.innerHTML = '';
            }
            row.appendChild(cell);

            // Line name and final stop
            cell = document.createElement('td');
            cell.innerHTML = fixup(entry.timetable.line.line_name);
            row.appendChild(cell);

            cell = document.createElement('td');
            var text = fixup(last_stop);
            if (fresh_timestamp(entry)) {
                text += ' (at ' + entry.arrival.clone().add(entry.delay).format('HH:mm') +')';
            }
            else {
                text += ' (at ' + entry.arrival.format('HH:mm') +')';
            }
            cell.innerHTML = text;
            row.appendChild(cell);

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

        //log('display_debug - running');

        var table = document.createElement('table');
        var heading = document.createElement('tr');
        var cell;

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.appendChild(document.createTextNode('OriginRef'));
        cell.appendChild(document.createElement('br'));
        cell.appendChild(document.createTextNode('DestRef'));
        cell.appendChild(document.createElement('br'));
        cell.appendChild(document.createTextNode('Vehicle'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.appendChild(document.createTextNode('Dep.'));
        cell.appendChild(document.createElement('br'));
        cell.appendChild(document.createTextNode('Due'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.appendChild(document.createTextNode('Seen'));
        cell.appendChild(document.createElement('br'));
        cell.appendChild(document.createTextNode('Delay'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.appendChild(document.createTextNode('Expected'));
        cell.appendChild(document.createElement('br'));
        cell.appendChild(document.createTextNode('In'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.appendChild(document.createTextNode('Route'));
        cell.appendChild(document.createElement('br'));
        cell.appendChild(document.createTextNode('Arrives'));
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.appendChild(document.createTextNode('To'));
        heading.appendChild(cell);

        table.appendChild(heading);

        var nrows = 0;

        for (var i=0; i<journey_table.length; i++) {
            var entry = journey_table[i];

            // Skip anything that left in the past
            if (entry.eta.isBefore(get_now().subtract(1, 'minutes'))) {
                continue;
            }

            nrows++;

            var last_stop = describe_stop(entry.destination);

            var row = document.createElement('tr');
            if (fresh_timestamp(entry)) {
                row.classList.add('seen');
            }
            else if (entry.departure.isBefore(moment())) {
                row.classList.add('issue');
            }

            cell = document.createElement('td');
            cell.appendChild(document.createTextNode(entry.origin.atco_code));
            cell.appendChild(document.createElement('br'));
            cell.appendChild(document.createTextNode(entry.destination.atco_code));
            cell.appendChild(document.createElement('br'));
            if (entry.vehicle) {
                cell.appendChild(document.createTextNode(entry.vehicle));
            }
            else{
                cell.appendChild(document.createTextNode('-'));
            }
            row.appendChild(cell);

            cell = document.createElement('td');
            cell.classList.add('time');
            cell.appendChild(document.createTextNode(entry.departure.format('HH:mm')));
            cell.appendChild(document.createElement('br'));
            cell.appendChild(document.createTextNode(entry.due.format('HH:mm')));
            row.appendChild(cell);

            cell = document.createElement('td');
            cell.classList.add('time');
            if (entry.rt_timestamp) {
                //log(entry.rt.received_timestamp);
                cell.appendChild(document.createTextNode(entry.rt_timestamp.format('HH:mm')));
            }
            else {
                cell.appendChild(document.createTextNode(''));
            }
            cell.appendChild(document.createElement('br'));
            if (entry.delay) {
                cell.appendChild(document.createTextNode(entry.delay.toISOString()));
            }
            else {
                cell.appendChild(document.createTextNode(''));
            }
            row.appendChild(cell);

            cell = document.createElement('td');
            cell.classList.add('time');
            if (fresh_timestamp(entry)) {
                cell.appendChild(document.createTextNode(entry.eta.format('HH:mm')));
            }
            else {
                cell.appendChild(document.createTextNode(''));
            }
            cell.appendChild(document.createElement('br'));
            cell.appendChild(document.createTextNode(entry.eta.fromNow(true)));
            row.appendChild(cell);

            cell = document.createElement('td');
            cell.appendChild(document.createTextNode(fixup(entry.timetable.line.line_name)));
            cell.appendChild(document.createElement('br'));
            cell.appendChild(document.createTextNode(entry.arrival.format('HH:mm')));
            row.appendChild(cell);

            cell = document.createElement('td');
            cell.appendChild(document.createTextNode(fixup(last_stop)));
            row.appendChild(cell);

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


    function display_nextbus() {
        // Layout showing next bus to selected destinations

        log('display_nextbus - running');

        var result = document.createElement('div');
        result.classList.add('nextbus');

        // Standard table heading
        var heading = document.createElement('tr');
        var cell;

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.innerHTML = 'Due';
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.innerHTML = 'Expected';
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.innerHTML = 'Route';
        heading.appendChild(cell);

        cell = document.createElement('th');
        cell.classList.add('time');
        cell.innerHTML = 'Arrives';
        heading.appendChild(cell);

        // For each destination...
        for (var d = 0; d < params.destinations.length; d++) {
            var destination = params.destinations[d];
            var nrows = 0;

            var h3 = document.createElement('h3');
            h3.innerHTML = 'To ' + destination.description;
            result.appendChild(h3);

            var table = document.createElement('table');
            table.appendChild(heading.cloneNode(true));

            // ...for each journey...
            for (var j=0; j<journey_table.length; j++) {
                var journey = journey_table[j];

                // Skip anything that has already left
                if (journey.eta.isBefore(get_now())) {
                    continue;
                }

                // If this journey goes to this destination
                if (journey.destinations[d]) {
                    var entry = journey.destinations[d];
                    var row = document.createElement('tr');
                    var arrival = timetable_time_to_moment(entry.time);

                    // Due time
                    cell = document.createElement('td');
                    cell.classList.add('time');
                    cell.innerHTML = journey.due.format('HH:mm');
                    row.append(cell);

                    // ETA
                    cell = document.createElement('td');
                    cell.classList.add('time');
                    if (fresh_timestamp(journey)) {
                        if (entry.delay.asMinutes() <= 1.0) {
                           cell.innerHTML = 'On time';
                        }
                        else {
                            cell.innerHTML = journey.eta.format('HH:mm');
                        }
                    }
                    else {
                        cell.innerHTML = '';
                    }
                    row.appendChild(cell);

                    // Line name
                    cell = document.createElement('td');
                    cell.innerHTML = fixup(journey.timetable.line.line_name);
                    row.appendChild(cell);

                    // Expected arrival
                    cell = document.createElement('td');
                    cell.classList.add('time');
                    if (fresh_timestamp(journey)) {
                        cell.innerHTML = arrival.clone().add(journey.delay).format('HH:mm');
                    }
                    else {
                        cell.innerHTML = arrival.format('HH:mm');
                    }
                    row.appendChild(cell);

                    table.appendChild(row);
                    nrows++;
                    if (nrows >= 2) {
                        break;
                    }

                } // END journey goes to this destination

            } // END for each journey

            if (nrows === 0) {
                var div = document.createElement('div');
                div.setAttribute('class','no-departures');
                div.innerHTML = 'No more departures today';
                result.appendChild(div);
            }
            else {
                result.append(table);
            }

        } // END for each destination

        return result;

    }


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


    function timetable_time_to_moment(time) {
        // Expand a UK localtime time into a full Date object based on today
        var result = moment().tz(TIMETABLE_TIMEZONE);
        result.hours(time.slice(0,2));
        result.minutes(time.slice(3,5));
        result.seconds(time.slice(6,8));
        result.milliseconds(0);
        return result;
    }


    function describe_stop(stop) {
        // Given a stop from the timetable, return a usable description

        var result = '';
        if (stop.locality_name.toLowerCase() !== 'cambridge') {
            result = stop.locality_name;
        }
        else {
            //if (stop.indicator.toLowerCase() in RELATION_INDICATORS) {
            //    result = stop.indicator + ' ';
            //}
            result = result + stop.common_name;
            //if (!(stop.indicator.toLowerCase() in RELATION_INDICATORS)) {
            //    result = result + ' ' + stop.indicator;
            //}
        }
        return result;
    }


    function fresh_timestamp(entry) {
        // is the latest RT information in entry fresh?
        return entry.rt_timestamp &&
                (entry.rt_timestamp.isAfter(moment().subtract(60, 's')));
    }


    function fixup(name) {
        // Fix assorted problems with bus and line names
        name = name.replace(/(\s+)Street$/i,'$1St');
        name = name.replace(/(\s+)Road$/i,'$1Rd');
        name = name.replace(/(\s+)Avenue$/i,'$1Ave');
        name = name.replace(/(\s+)Close$/i,'$1Cl');
        name = name.replace(/\|.*/, '');
        name = name.replace(/Park[ -](and|&)[ -]Ride/i, 'P&R');
        name = name.replace(/Road P&R/i, 'Rd P&R');
        name = name.replace(/Bus Station/i, 'Bus Stn');
        name = name.replace(/Cambridge North Railway Station/i, 'Cambridge Nth Stn');
        name = name.replace(/Hinchingbrooke/i, 'Hin\'brooke');
        return name;
    }


    function get_now() {
        // Return the current time offset by params.offset or 0
        var offset = params.offset || 0;
        return moment().add(offset, 'minutes');
    }


    log('Instantiated StopTimetable', container, params);

    // END of 'class' StopTimetable

}

/*

Example timetable API result:

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

Example real time monitoring record:

{
    "Bearing": "12",
    "DataFrameRef": "1",
    "DatedVehicleJourneyRef": "32",
    "Delay": "PT4M7S",
    "DestinationName": "Lavender Crescent",
    "DestinationRef": "0590PDD384",
    "DirectionRef": "INBOUND",
    "InPanic": "0",
    "Latitude": "52.5558243",
    "LineRef": "5",
    "Longitude": "-0.2270660",
    "Monitored": "true",
    "OperatorRef": "SCCM",
    "OriginAimedDepartureTime": "2018-01-22T08:30:00+00:00",
    "OriginName": "Western Spine Road",
    "OriginRef": "0590PSP940",
    "PublishedLineName": "5",
    "RecordedAtTime": "2018-01-22T08:40:07+00:00",
    "ValidUntilTime": "2018-01-22T08:40:07+00:00",
    "VehicleMonitoringRef": "SCCM-37222",
    "VehicleRef": "SCCM-37222",
    "acp_id": "SCCM-37222",
    "acp_lat": 52.5558243,
    "acp_lng": -0.227066,
    "acp_ts": 1516610407
},

*/
