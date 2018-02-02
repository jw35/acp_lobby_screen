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

    this.refresh_timer = {};

    this.REFRESH_INTERVAL = 60; // seconds

    this.stops_cache = {}; // store the stops we collect from the journeys through the current stop

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
    // can also have "&nresults=XX" for max # of journeys to return

    var uri = parent.TIMETABLE_URI+'/journeys_by_time_and_stop/'+qs;

    console.log('get_stop_journeys: getting '+stop_id+
                ' @ '+datetime_from);

    var xhr = new XMLHttpRequest();

    xhr.open("GET", uri, true);

    xhr.send();

    xhr.onreadystatechange = function() {//Call a function when the state changes.
        if(xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200)
        {
            //console.log('got route profile for '+sensor_id);
            parent.add_api_stop_data(parent, stop_id, datetime_from, xhr.responseText);
            parent.update_stop(parent, stop_id);
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
        console.log('add_api_stop_journeys: failed to parse API response for '+
                    stop_id+' @ '+datetime_from);
        console.log(api_response);
        return;
    }

    var stop = parent.stops_cache[stop_id];

    if (!stop)
    {
        console.log('add_api_stop_journeys: '+stop_id+' not in cache');
        return;
    }

    if (!api_data.results)
    {
        console.log('add_api_stop_journeys: null results for '+
                    stop_id+' @ '+datetime_from);
        console.log(api_response);
        stop.journeys = null;
        return;
    }

    if (!api_data.results[0])
    {
        console.log('add_api_stop_journeys: empty results for '+
                    stop_id+' @ '+datetime_from);
        stop.journeys = null;

        return;
    }

    console.log('add_api_stop_journeys: processing '+api_data.results.length+' journeys');

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
this.update_stop = function(parent, stop_id)
{
    console.log('handle_stop_journeys: '+stop_id+' '+parent.stops_cache[stop_id].journeys.length);

    var stop = parent.stops_cache[stop_id];

    var journeys = stop.journeys;

    parent.draw_departures(parent, stop);

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

    for (var i=0; i<stop.departures.length; i++)
    {
        var departure = stop.departures[i];
        var journey = stop.journeys[i];
        var last_stop = journey[journey.length-1].common_name;

        var row = document.createElement('tr');

        var td1 = document.createElement('td');
        td1.innerHTML = departure.time.slice(0,5);
        var td2 = document.createElement('td');
        td2.innerHTML = departure.line_name + ' (' + last_stop + ')';
        var td3 = document.createElement('td');
        td3.innerHTML = 'Sometime';

        row.appendChild(td1);
        row.appendChild(td2);
        row.appendChild(td3);
        table.appendChild(row);

        parent.departures.appendChild(table);
    }
}

// ****************************************************************************************
// ************* REAL-TIME BUS POSITIONS   ************************************************
// ****************************************************************************************
//

this.rtmonitor_disconnected = function()
{
    this.log('stop_timetable rtmonitor_disconnected');
    document.getElementById(this.container+'_connection').style.display = 'inline-block';
}

this.rtmonitor_connected = function()
{
    this.log('stop_timetable rtmonitor_connected');
    document.getElementById(this.container+'_connection').style.display = 'none';
};

this.subscribe = function()
{
    var map_bounds = this.map.getBounds();

    var map_sw = map_bounds.getSouthWest();

    var map_ne = map_bounds.getNorthEast();

    var boundary_ns = (map_ne.lat - map_sw.lat) * 0.5; // We will subscribe to real-time data
                                                       // In a box larger than the map bounds
    var boundary_ew = (map_ne.lng - map_sw.lng) * 0.5;

    var north = map_ne.lat + boundary_ns;

    var south = map_sw.lat - boundary_ns;

    var east = map_ne.lng + boundary_ew;

    var west = map_sw.lng - boundary_ew;

    L.rectangle([[south,west],[north,east]], { fillOpacity: 0 }).addTo(this.map);

    var request_id = this.container+'_A';

    // Subscribe to the real-time data INSIDE a clockwise rectangle derived from map bounds
    var request = '{ "msg_type": "rt_subscribe", '+
                     '  "request_id": "'+request_id+'", '+
                     '  "filters": [ { "test": "inside", '+
                     '                 "lat_key": "Latitude", '+
                     '                 "lng_key": "Longitude", '+
                     '                 "points": [ '+
                     '                            {  "lat": '+north+', "lng": '+west+' }, '+
                     '                            {  "lat": '+north+', "lng": '+east+' }, '+
                     '                            {  "lat": '+south+', "lng": '+east+' }, '+
                     '                            {  "lat": '+south+', "lng": '+west+' } '+
                     '                          ]'+
                     '              } ]'+
                     '}';

    RTMONITOR_API.request(this, request_id, request, this.handle_records)
}

// ********************************************************************************
// ***********  Process the data records arrived from WebSocket or Replay *********
// ********************************************************************************

// Process websocket data
this.handle_records = function(websock_data)
{
    var incoming_data = JSON.parse(websock_data);
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
    // new sensor, create marker
    this.log(' ** New '+msg[this.RECORD_INDEX]);

    var sensor_id = msg[this.RECORD_INDEX];

    var sensor = { sensor_id: sensor_id,
                   msg: msg,
                 };

    sensor.state = {};

    this.sensors[sensor_id] = sensor;

    // flag if this record is OLD or NEW
    this.init_old_status(sensor, new Date());

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

            // move marker
            var pos = this.get_msg_point(msg);

            // flag if this record is OLD or NEW
            this.update_old_status(sensor, new Date());

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
// Given a data record, update '.old' property t|f and reset marker icon
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
            this.map.removeLayer(sensor.marker);
            sensor.state.obsolete = true;
            return;
        }
        // data record is OLD
        // skip if this data record is already flagged as old
        if (sensor.state.old != null && sensor.state.old)
        {
            return;
        }
        // set the 'old' flag on this record and update icon
        this.log('update_old_status OLD '+sensor.msg[this.RECORD_INDEX]);
        sensor.state.old = true;
        sensor.marker.setIcon(this.oldsensorIcon);
    }
    else
    {
        // data record is NOT OLD
        // skip if this data record is already NOT OLD
        if (sensor.state.old != null && !sensor.state.old)
        {
            return;
        }
        // reset the 'old' flag on this data record and update icon
        sensor.state.old = false;
        sensor.marker.setIcon(this.create_sensor_icon(sensor.msg));
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

