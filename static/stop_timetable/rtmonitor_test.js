/* Bus Stop Timetable Widget for ACP Lobby Screen */

// used in lobby screen with:
//      new StopTimetable(<container div id>, <params object>)
//
//      e.g.
//
//      new StopTimetable('stop_timetable_1',         // 'id' of DOM object (e.g. DIV) this widget should launch into
//                     { stop_id: '0500CCITY424',
//                       common_name: 'William Gates Building', // Temporary, pending NaPTAN API
//                       lat: 52.21129,                         // Dito
//                       lng: 0.09107                           // Dito
//                      });
//
function StopTimetable(container, params) {

    this.container = container;
    this.params = params;

    this.sensors = {};

    this.TIMETABLE_URI = 'http://tfc-app3.cl.cam.ac.uk/transport/api';

    this.MAX_STOP_JOURNEYS = 15; // Limit results when requesting journeys through stop

    this.OLD_DATA_RECORD = 70; // time (s) threshold where a data record is considered 'old'

    this.OBSOLETE_DATA_RECORD = 140; // at this age, we discard the sensor

    this.CRUMB_COUNT = 400; // how many breadcrumbs to keep on the page

    // Here we define the 'data record format' of the incoming websocket feed
    this.RECORD_INDEX = 'VehicleRef';  // data record property that is primary key
    this.RECORDS_ARRAY = 'request_data'; // incoming socket data property containing data records
    this.RECORD_TS = 'RecordedAtTime'; // data record property containing timestamp
    this.RECORD_TS_FORMAT = 'ISO8601'; // data record timestamp format
                                       // 'ISO8601' = iso-format string
    this.RECORD_LAT = 'Latitude';      // name of property containing latitude
    this.RECORD_LNG = 'Longitude';     // name of property containing longitude
    this.RECORD_ORIGIN_STOP_ID = 'OriginRef'; // SiriVM origin stop_id
    this.RECORD_ORIGIN_TIME = 'OriginAimedDepartureTime'; // SiriVM origin timetable departure time
    this.RECORD_DELAY = 'Delay'; // SiriVM 'XML Duration' delay value e.g. "PT2M8S"

    this.refresh_timer = {};

    this.REFRESH_INTERVAL = 60; // seconds

    this.stops_cache = {}; // store the stops we collect from the journeys through the current stop

    this.rtmonitor_subscriptions = {}; // Dictionary of SiriVM subscriptions indexed on <stop>_<time>

    this.init = function() {
        var self = this;

        var container_el = document.getElementById(container);

        this.log("Running StopTimetable.init", this.container);

        // Empty the 'container' div (i.e. remove loading GIF)
        while (container_el.firstChild) {
                container_el.removeChild(container_el.firstChild);
        }

        // Write HTML into 'container' div:
        //
        // <div class="stop_timetable">
        //   <div class="content_area">
        //     <h1>Title</h1>
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
        container_el.appendChild(stop_timetable);

        var content_area = document.createElement('div');
        content_area.setAttribute('class', 'content_area');
        stop_timetable.appendChild(content_area);

        var title = document.createElement('h1');
        title.innerHTML = this.params.common_name;
        content_area.appendChild(title);

        var connection_div = document.createElement('div');
        connection_div.setAttribute('class','stop_timetable_connection_div');
        connection_div.setAttribute('id', this.container+'_connection');
        connection_div.innerHTML = "Connection issues";
        container_el.appendChild(connection_div);

        this.departures = document.createElement('div');
        content_area.appendChild(this.departures);

        this.load_stop(this,
                       { stop_id: this.params.stop_id,
                         common_name: this.params.common_name,
                         lat: this.params.lat,
                         lng: this.params.lng
                       });

        this.get_stop_journeys(this, this.params.stop_id);

        RTMONITOR_API.ondisconnect(this, this.rtmonitor_disconnected);

        RTMONITOR_API.onconnect(this, this.rtmonitor_connected);

        /*
        this.do_load();
        */
    }

    /*this.reload = function() {
        this.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/


    /*
    this.do_load = function () {
        var self = this;
        this.log("Running StopTimetable.do_load", this.container);
        this.log("StopTimetable.do_load done", this.container);
    }


*/

// ***************************************************************************
// *******************  Transport API     ************************************
// **********************************i****************************************
//

// Call the API to get the journeys through a given stop
this.get_stop_journeys = function(parent, stop_id)
{
    var datetime_from = parent.hh_mm_ss(new Date());

    var qs = '?stop_id='+encodeURIComponent(stop_id);
    qs += '&datetime_from='+encodeURIComponent(datetime_from);
    qs += '&expand_journey=true';
    qs += '&nresults='+parent.MAX_STOP_JOURNEYS;

    // can also have "&nresults=XX" for max # of journeys to return

    var uri = parent.TIMETABLE_URI+'/journeys_by_time_and_stop/'+qs;

    parent.log('stop_timetable get_stop_journeys: getting '+stop_id+
                ' @ '+datetime_from);

    var xhr = new XMLHttpRequest();

    xhr.open("GET", uri, true);

    xhr.send();

    xhr.onreadystatechange = function() {//Call a function when the state changes.
        if(xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200)
        {
            //console.log('got route profile for '+sensor_id);
            parent.add_api_stop_data(parent, stop_id, datetime_from, xhr.responseText);
            parent.handle_stop_journeys(parent, stop_id);
        }
    }
}

// Update a stop.journeys property with the data from the transport API
this.add_api_stop_data = function(parent, stop_id, datetime_from, api_response)
{
    var api_data;
    try
    {
        api_data = JSON.parse(api_response);
    }
    catch (e)
    {
        parent.log('stop_timetable add_api_stop_journeys: failed to parse API response for '+
                    stop_id+' @ '+datetime_from);
        parent.log(api_response);
        return;
    }

    var stop = parent.stops_cache[stop_id];

    if (!stop)
    {
        parent.log('stop_timetable add_api_stop_journeys: '+stop_id+' not in cache');
        return;
    }

    if (!api_data.results)
    {
        parent.log('stop_timetable add_api_stop_journeys: null results for '+
                    stop_id+' @ '+datetime_from);
        parent.log(api_response);
        stop.journeys = null;
        return;
    }

    if (!api_data.results[0])
    {
        parent.log('stop_timetable add_api_stop_journeys: empty results for '+
                    stop_id+' @ '+datetime_from);
        stop.journeys = null;

        return;
    }

    parent.log('stop_timetable add_api_stop_journeys: processing '+api_data.results.length+' journeys');

    stop.journeys = [];

    stop.departures = [];

    for (var i=0; i<api_data.results.length; i++)
    {
        var result = api_data.results[i];

        stop.departures.push( { time: result.time,
                                line_name: result.line.line_name
                              });

        var journey_stops = result.journey.timetable.length;

        var journey = new Array(journey_stops);

        for (var j=0; j<journey_stops; j++)
        {
            journey[j] = result.journey.timetable[j].stop;

            if (journey[j].id)
            {
                journey[j].stop_id = journey[j].id;
            }
            journey[j].time = result.journey.timetable[j].time;

            // add this stop to stops_cache if it's not already in there
            if (!parent.stops_cache.hasOwnProperty(journey[j].stop_id))
            {
                parent.load_stop(parent, journey[j]);
            }

        }
        stop.journeys.push(journey);
    }
}

// Deal with a stop that now has an updated 'journeys' property
//
this.handle_stop_journeys = function(parent, stop_id)
{
    // Do nothing if this stop is not in cache (an error)
    if (!parent.stops_cache[stop_id])
    {
        return;
    }

    var stop = parent.stops_cache[stop_id];

    parent.log('stop_timetable handle_stop_journeys: '+stop_id+
               ' journeys: '+(stop.journeys ? stop.journeys.length : 0));

    parent.draw_departures(parent, stop);

    if (stop.journeys)
    {
        parent.subscribe_journeys.call(parent, stop_id);
    }

}

this.load_stop = function(parent, stop)
{
    if (!stop.stop_id)
    {
        stop.stop_id = stop['atco_code'];
    }

    if (!stop.lat)
    {
        stop.lat = stop['latitude'];

        stop.lng = stop['longitude'];
    }

    parent.stops_cache[stop.stop_id] = stop;
}

/*

this.stops_cache_miss = function(parent, stop_id)
{
    return !parent.stops_cache.hasOwnProperty(stop_id);
}

*/

this.draw_departures = function(parent, stop)
{
/*
<table>
  <tr>
    <th>Time</th>
    <th>Destination</th>
    <th>Expected</th>
  </tr>
{% for service in data.trainServices.service %}
  {% set dest = service.destination.location.0.locationName %}
  {% if dest == 'London Kings Cross' %}
    {% set dest = 'London Kings X' %}
  {% elif dest == 'London Liverpool Street' %}
    {% set dest = 'London Liv. St' %}
  {% elif dest == 'Birmingham New Street' %}
    {% set dest = "Birm'ham New St" %}
  {% endif %}
  {% if service.etd != 'On time' %}
  <tr class="issue">
  {% else %}
  <tr>
  {% endif %}
    <td>{{ service.std }}</td>
    <td>{{ dest }}</td>
    <td>{{ service.etd }}</td>
  </tr>
{% endfor %}
</table>
*/

    // Handle case where the API query returned NO journeys through this stop
    if (!stop.departures || stop.departures.length == 0)
    {
        var no_departures_msg = document.createElement('div');
        no_departures_msg.innerHTML = 'No departures from this stop';
        parent.departures.appendChild(no_departures_msg);
        return;
    }

    var stop_info = document.createElement('div');

    stop_info.innerHTML = stop.departures.length + ' departures';

    parent.departures.appendChild(stop_info);

    // OK, we have some journeys through this stop, i.e. departures, so list them
    var table = document.createElement('table');

    var heading = document.createElement('tr');

    var th1 = document.createElement('th');
    th1.innerHTML = 'Time';
    var th2 = document.createElement('th');
    th2.innerHTML = 'Route';
    var th3 = document.createElement('th');
    th3.innerHTML = 'Destination';
    var th4 = document.createElement('th');
    th4.innerHTML = 'Realtime';

    heading.appendChild(th1);
    heading.appendChild(th2);
    heading.appendChild(th3);
    heading.appendChild(th4);
    table.appendChild(heading);

    for (var i=0; i<stop.departures.length; i++)
    {
        var origin_stop_id = stop.journeys[i][0].stop_id;

        var origin_time = stop.journeys[i][0].time;

        var row_id = parent.container+'_'+origin_stop_id+'_'+origin_time;

        var departure = stop.departures[i];
        var journey = stop.journeys[i];
        var last_stop = journey[journey.length-1].common_name;

        var row = document.createElement('tr');

        var td1 = document.createElement('td');
        td1.innerHTML = departure.time.slice(0,5);
        var td2 = document.createElement('td');
        td2.innerHTML = departure.line_name;
        var td3 = document.createElement('td');
        td3.innerHTML = last_stop;
        var td4 = document.createElement('td');
        td4.setAttribute('id',row_id+'_expected');
        td4.innerHTML = origin_stop_id+' '+origin_time;

        row.appendChild(td1);
        row.appendChild(td2);
        row.appendChild(td3);
        row.appendChild(td4);
        table.appendChild(row);

        parent.departures.appendChild(table);
    }
}

this.update_departure = function(sensor)
{
    var origin_stop_id = sensor.msg[this.RECORD_ORIGIN_STOP_ID];
    var origin_time = sensor.msg[this.RECORD_ORIGIN_TIME].slice(11,19);
    var cell_id = this.container+'_'+origin_stop_id+'_'+origin_time+'_expected';

    this.log('writing '+ sensor.sensor_id+' to '+cell_id);

    var el = document.getElementById(cell_id);
    if (el)
    {
        el.innerHTML = sensor.sensor_id;
        el.setAttribute('class','stop_timetable_realtime');
    }
}

// ****************************************************************************************
// ************* REAL-TIME BUS POSITIONS  via RTMonitorAPI ********************************
// ****************************************************************************************
//

// this function will be called by RTMonitorAPI if it DISCONNECTS from server
this.rtmonitor_disconnected = function()
{
    this.log('stop_timetable rtmonitor_disconnected');
    document.getElementById(this.container+'_connection').style.display = 'inline-block';
}

// this function will be called by RTMonitorAPI each time it has CONNECTED to server
this.rtmonitor_connected = function()
{
    this.log('stop_timetable rtmonitor_connected');
    document.getElementById(this.container+'_connection').style.display = 'none';
};

// this Widget calls 'subscribe()' each time it has a new origin stop/time so that
// it will receive real-time updates for the relevant bus
this.subscribe = function(stop_id, time)
{
    var request_id = this.container+'_'+stop_id+'_'+time;

    // Subscribe to the real-time data INSIDE a clockwise rectangle derived from map bounds
    var request_msg = '{ "msg_type": "rt_subscribe", '+
                        '"request_id": "'+request_id+'", '+
                        '"filters": [ { "test": "=", '+
                                       '"key": "'+this.RECORD_ORIGIN_STOP_ID+'", '+
                                       '"value": "'+stop_id+'"'+
                                     '},'+
                                     '{ "test": "=", '+
                                        '"key": "'+this.RECORD_ORIGIN_TIME+'", '+
                                        '"value": "'+time+'"'+
                                     '} ]'+
                      '}';

    var request_info = { stop_id: stop_id,
                         time: time,
                         subscribed: false
                       };

    var request_status = RTMONITOR_API.request(this, request_id, request_msg, this.handle_records);

    this.rtmonitor_subscriptions[stop_id+'_'+time] = request_info;

    if (request_status.status == 'rt_ok')
    {
        request_info.subscribed = true;
        this.log('stop_timetable subscribed ok '+stop_id+' '+time);
    }
    else
    {
        //debug we need to implement timer to retry the request
        // this issue is normal if stop journeys arrive before rtmonitor_api is ready
        this.log('stop_timetable subscribe failed '+JSON.stringify(request_status));
    }
}

// We have a new list of journeys for the current stop, so send real-time subscription requests
this.subscribe_journeys = function(stop_id)
{
    var stop = this.stops_cache[stop_id];

    //debug testing next 3 arrivals max
    //
    var journey_count = stop.journeys.length;
    //var journey_count = Math.min(3, stop.journeys.length);

    for (var i=0; i<journey_count; i++)
    {
        var journey = stop.journeys[i];
        var origin_stop_id = journey[0].stop_id;
        var origin_time = this.time_to_iso(journey[0].time);
        this.subscribe(origin_stop_id, origin_time);
    }
}

// Convert timetable time (from journey origin time) to ISO today time (for SiriVM lookup)
// e.g. "16:20:00" -> "2018-02-04T16:20:00+00:00"
//debug we MAY need to shift to yesterday
this.time_to_iso = function(time)
{
    var now = new Date();

    var iso_time = now.getFullYear()+'-'+
                  ('0' + (now.getMonth() + 1)).slice(-2)+'-'+
                  ('0' + now.getDate()).slice(-2)+
                  'T'+
                  time +
                  '+00:00';
    return iso_time;
}

// ********************************************************************************
// ***********  Process the data records arrived from WebSocket or Replay *********
// ********************************************************************************

// Process websocket data
this.handle_records = function(incoming_data)
{
    this.log('stop_timetable handle_records incoming data'+
             ' ('+ incoming_data[this.RECORDS_ARRAY].length + ' records');
    //this.log('handle_records'+json['request_data'].length);
    for (var i = 0; i < incoming_data[this.RECORDS_ARRAY].length; i++)
    {
	    this.handle_msg(incoming_data[this.RECORDS_ARRAY][i], new Date());
    }
} // end function handle_records

// process a single data record
this.handle_msg = function(msg, clock_time)
{
    // Add a timestamp for when we received this data record
    msg.received_timestamp = new Date();

    var sensor_id = msg[this.RECORD_INDEX];

    this.log('stop_timetable handling msg for '+sensor_id);

    // If an existing entry in 'this.sensors' has this key, then update
    // otherwise create new entry.
    if (this.sensors.hasOwnProperty(sensor_id))
    {
        this.update_sensor(msg, clock_time);
    }
    else
    {
        this.create_sensor(msg, clock_time);
    }
}

// We have received data from a previously unseen sensor, so initialize
this.create_sensor = function(msg, clock_time)
{
    // new sensor
    this.log('stop_timetable ** New '+msg[this.RECORD_INDEX]);

    var sensor_id = msg[this.RECORD_INDEX];

    var sensor = { sensor_id: sensor_id,
                   msg: msg,
                 };

    sensor.state = {};

    this.sensors[sensor_id] = sensor;

    // flag if this record is OLD or NEW
    this.init_old_status(sensor, new Date());

    this.update_departure(sensor);
}

// We have received a new data message from an existing sensor, so analyze and update state
this.update_sensor = function(msg, clock_time)
{
		// existing sensor data record has arrived

        var sensor_id = msg[this.RECORD_INDEX];

		if (this.get_msg_date(msg).getTime() != this.get_msg_date(this.sensors[sensor_id].msg).getTime())
        {
            // store as latest msg
            // moving current msg to prev_msg
            this.sensors[sensor_id].prev_msg = this.sensors[sensor_id].msg;
		    this.sensors[sensor_id].msg = msg; // update entry for this msg

            var sensor = this.sensors[sensor_id];

            // flag if this record is OLD or NEW
            this.update_old_status(sensor, new Date());

            this.update_departure(sensor);
		}
}

this.timer_update = function(parent)
{
    parent.check_old_records(parent, new Date());

    // cull obsolete sensors
    //
    for (var sensor_id in parent.sensors)
    {
        if (parent.sensors.hasOwnProperty(sensor_id) && parent.sensors[sensor_id].state.obsolete)
        {
            parent.log('culling '+sensor_id);
            delete parent.sensors[sensor_id];
        }
    }

}
// Given a data record, update '.old' property t|f
// Note that 'current time' is the JS date value in global 'clock_time'
// so that this function works equally well during replay of old data.
//
this.init_old_status = function(sensor, clock_time)
{
    this.update_old_status(sensor, clock_time);
}

this.update_old_status = function(sensor, clock_time)
{
    var data_timestamp = sensor.msg.received_timestamp;

    //var data_timestamp = this.get_msg_date(sensor.msg); // will hold Date from sensor

    // get current value of sensor.state.old flag (default false)
    var current_old_flag = !(sensor.state.old == null) || sensor.state.old;

    // calculate age of sensor (in seconds)
    var age = (clock_time - data_timestamp) / 1000;

    if (age > this.OLD_DATA_RECORD)
    {
        if (age > this.OBSOLETE_DATA_RECORD)
        {
            sensor.state.obsolete = true;
            return;
        }
        // data record is OLD
        // skip if this data record is already flagged as old
        if (sensor.state.old != null && sensor.state.old)
        {
            return;
        }
        // set the 'old' flag on this record
        //
        this.log('update_old_status OLD '+sensor.msg[this.RECORD_INDEX]);
        sensor.state.old = true;
    }
    else
    {
        // data record is NOT OLD
        // skip if this data record is already NOT OLD
        if (sensor.state.old != null && !sensor.state.old)
        {
            return;
        }
        // reset the 'old' flag on this data record
        sensor.state.old = false;
    }
}

// return {lat:, lng:} from sensor message
this.get_msg_point = function(msg)
{
    return { lat: msg[this.RECORD_LAT], lng: msg[this.RECORD_LNG] };
}

// return a JS Date() from sensor message
this.get_msg_date = function(msg)
{
    switch (this.RECORD_TS_FORMAT)
    {
        case 'ISO8601':
            return new Date(msg[this.RECORD_TS]);
            break;

        default:
            break;
    }
    return null;
}

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

// End of the XML duration pretty print code
// *************************************************************

// watchdog function to flag 'old' data records
// records are stored in 'this.sensors' object
this.check_old_records = function(parent, clock_time)
{
    //parent.log('checking for old data records..,');

    // do nothing if timestamp format not recognised
    switch (parent.RECORD_TS_FORMAT)
    {
        case 'ISO8601':
            break;

        default:
            return;
    }

    for (var sensor_id in parent.sensors)
    {
        parent.update_old_status(parent.sensors[sensor_id], clock_time);
    }
}

// return provided JS Date() as HH:MM:SS
this.hh_mm_ss = function(datetime)
{
    var hh = ('0'+datetime.getHours()).slice(-2);
    var mm = ('0'+datetime.getMinutes()).slice(-2);
    var ss = ('0'+datetime.getSeconds()).slice(-2);
    return hh+':'+mm+':'+ss;
}

this.log = function() {
    if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('stop_timetable_log') >= 0) {
        console.log.apply(console, arguments);
    }
};

this.log("Instantiated StopTimetable", container, params);

// END of 'class' StopTimetable
}

