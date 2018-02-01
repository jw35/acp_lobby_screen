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

    /*

    this.sensors = {};

    this.progress_indicators = {}; // dictionary by VehicleRef

    this.RTMONITOR_URI = 'http://tfc-app2.cl.cam.ac.uk/rtmonitor/sirivm';

    */

    this.TIMETABLE_URI = 'http://tfc-app3.cl.cam.ac.uk/transport/api';

    /*

    this.OLD_DATA_RECORD = 70; // time (s) threshold where a data record is considered 'old'

    this.OBSOLETE_DATA_RECORD = 140; // at this age, we discard the sensor

    this.PROGRESS_MIN_DISTANCE = 20;

    this.CRUMB_COUNT = 400; // how many breadcrumbs to keep on the page

    // Here we define the 'data record format' of the incoming websocket feed
    this.RECORD_INDEX = 'VehicleRef';  // data record property that is primary key
    this.RECORDS_ARRAY = 'request_data'; // incoming socket data property containing data records
    this.RECORD_TS = 'RecordedAtTime'; // data record property containing timestamp
    this.RECORD_TS_FORMAT = 'ISO8601'; // data record timestamp format
                                       // 'ISO8601' = iso-format string
    this.RECORD_LAT = 'Latitude';      // name of property containing latitude
    this.RECORD_LNG = 'Longitude';     // name of property containing longitude

    // *****************
    //
    this.STATIC_URL = params.static_url;

    this.ICON_URL = this.STATIC_URL+'/stop_bus_map/images/bus-logo.png';


    this.ICON_IMAGE = new Image();
    this.ICON_IMAGE.src = this.ICON_URL;

    this.icon_size = 'L';

    this.oldsensorIcon = L.icon({
        iconUrl: this.ICON_URL,
        iconSize: [20, 20]
    });

    // *************************
    // **** Routes stuff

    this.bus_stop_icon = L.icon({
        iconUrl: this.STATIC_URL+'/stop_bus_map/images/bus_stop.png',
        iconSize: [15,40],
        iconAnchor: [3,40]
    });

    this.crumbs = []; // array to hold breadcrumbs as they are drawn

    this.sock = {}; // the page's WebSocket

    this.sock_timer = {}; // intervalTimer we use for retries iif socket has failed

    this.refresh_timer = {};

    this.REFRESH_INTERVAL = 60; // seconds

    */

    this.stops_cache = {}; // store the stops we collect from the journeys through the current stop

    this.init = function() {
        var self = this;

        var container_el = document.getElementById(container);

        this.log("Running StopBusMap.init", this.container);

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

        this.departures = document.createElement('div');
        content_area.appendChild(this.departures);

        /*
        var map_div = document.createElement('div');
        map_div.setAttribute('class','stop_bus_map_div');
        map_div.setAttribute('id', this.container+'_map');
        container_el.appendChild(map_div);

        var connection_div = document.createElement('div');
        connection_div.setAttribute('class','stop_bus_map_connection_div');
        connection_div.setAttribute('id', this.container+'_connection');
        connection_div.innerHTML = "Connection issues";
        container_el.appendChild(connection_div);

        this.map = L.map(map_div, { zoomControl:false }).setView([this.params.lat, this.params.lng], this.params.zoom);
        this.map_tiles = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.map);

        this.sock_connect(self);

        this.draw_stop(params.stop_id);

        // create a timer to update the progress indicators every second
        this.progress_timer = setInterval( (function (parent) { return function () { parent.timer_update(parent) }; })(self),
                                           1000);

        // listener to detect ESC 'keydown' while in map_only mode to escape back to normal
        document.onkeydown = function(evt) {
            evt = evt || window.event;
            if (evt.keyCode == 27) // ESC to escape from map-only view
            {
                self.sock_close();
                clearInterval(self.progress_timer);
            }
        }; // end onkeydown
        */

        this.load_stop(this,
                       { stop_id: this.params.stop_id,
                         common_name: this.params.common_name,
                         lat: this.params.lat,
                         lng: this.params.lng
                       });

        this.get_stop_journeys(this, this.params.stop_id);

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


// Stops API shim
//
this.stop_id_to_stop = function(stop_id)
{
    return { lat: 52.2113, lng: 0.091 };
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

    /*
    hide_journeys();

    for (var i=0; i<journeys.length; i++)
    {
        // using a drawn_journey_id of stop-STOP_ID-N where N is arbitrary index
        draw_journey('stop-'+stop_id+'-'+i,journeys[i]);
    }
    */
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

    /*
    var bus_stop_marker = L.marker([stop.lat, stop.lng],
                                   {icon: bus_stop_icon});
    var popup = L.popup({ closeOnClick: false,
                          autoClose: false,
                          offset: L.point(0,-25)})
        .setContent(stop_content(stop));

    bus_stop_marker.bindPopup(popup);
    stop.marker = bus_stop_marker;
    */
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

/*

// ***************************************************************************
// *******************  WebSocket code    ************************************
// ***************************************************************************
// sock_connect() will be called on startup (i.e. in init())
// It will connect socket, when successful will
// send { 'msg_type': 'rt_connect'} message, and should receive { 'msg_type': 'rt_connect_ok' }, then
// send { 'msg_type': 'rt_subscribe', 'request_id' : 'A' } which subsribes to ALL records.
this.sock_connect = function(parent)
{
    parent.sock = new SockJS(parent.RTMONITOR_URI);

    parent.sock.onopen = function() {
                parent.log('** socket open');
                clearInterval(parent.sock_timer); // delete reconnect timer if it's running
                document.getElementById(parent.container+'_connection').style.display = 'none';
                parent.sock_send_str('{ "msg_type": "rt_connect" }');
                };

    parent.sock.onmessage = function(e) {
                var json_msg = JSON.parse(e.data);
                if (json_msg.msg_type != null && json_msg.msg_type == "rt_nok")
                {
                    parent.log('<span class="log_error">** '+e.data+'</span>');
                    return;
                }
                if (json_msg.msg_type != null && json_msg.msg_type == "rt_connect_ok")
                {
                    parent.log('Connected OK');

                    var map_bounds = parent.map.getBounds();

                    var map_sw = map_bounds.getSouthWest();

                    var map_ne = map_bounds.getNorthEast();

                    var boundary_ns = (map_ne.lat - map_sw.lat) * 0.5; // We will subscribe to real-time data
                                                                       // In a box larger than the map bounds
                    var boundary_ew = (map_ne.lng - map_sw.lng) * 0.5;

                    var north = map_ne.lat + boundary_ns;

                    var south = map_sw.lat - boundary_ns;

                    var east = map_ne.lng + boundary_ew;

                    var west = map_sw.lng - boundary_ew;

                    L.rectangle([[south,west],[north,east]], { fillOpacity: 0 }).addTo(parent.map);

                    // Subscribe to the real-time data INSIDE a clockwise rectangle derived from map bounds
                    var rt_request = '{ "msg_type": "rt_subscribe", '+
                                     '  "request_id": "'+parent.container+'_A", '+
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

                    //parent.log(rt_request);

                    parent.sock_send_str(rt_request);

                    return;
                }
                parent.handle_records(e.data);
                };

    parent.sock.onclose = function() {
                parent.log('** socket closed, starting reconnect timer');
                // start interval timer trying to reconnect
                clearInterval(parent.sock_timer);

                document.getElementById(parent.container+'_connection').style.display = 'inline-block';
                parent.sock_timer = setInterval(function (obj) { return function () { parent.sock_reconnect(parent); } }(parent), 10000);
                };
}

this.sock_reconnect = function(parent)
{
    parent.log('sock_reconnect trying to connect');
    parent.sock_connect(parent);
}

this.sock_close = function()
{
    this.log('** closing socket...');
    this.sock.close();
}

this.sock_send = function(input_name)
{
    var msg = document.getElementById(input_name).value;

    this.sock_send_str(msg);
}

this.sock_send_str = function(msg)
{
    if (this.sock == null)
    {
	    this.log('<span style="color: red;">Socket not yet connected</span>');
	    return;
    }
    if (this.sock.readyState == SockJS.CONNECTING)
    {
	    this.log('<span style="color: red;">Socket connecting...</span>');
  	    return;
    }
    if (this.sock.readyState == SockJS.CLOSING)
    {
	    this.log('<span style="color: red;">Socket closing...</span>');
	    return;
    }
    if (this.sock.readyState == SockJS.CLOSED)
    {
	    this.log('<span style="color: red;">Socket closed</span>');
	    return;
    }

    this.log('sending: '+msg);

    this.sock.send(msg);
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

    var marker_icon = this.create_sensor_icon(msg);

    sensor['marker'] = L.Marker.movingMarker([[msg[this.RECORD_LAT], msg[this.RECORD_LNG]],
                                                   [msg[this.RECORD_LAT], msg[this.RECORD_LNG]]],
                                                  [1000],
                                                  {icon: marker_icon});
    sensor['marker']
        .addTo(this.map)
        .bindPopup(this.popup_content(msg), { className: "sensor-popup"})
        .bindTooltip(this.tooltip_content(msg), {
                            // permanent: true,
                            className: "sensor-tooltip",
                            interactive: true
                          })
        .on('click', function()
                {
                  //this.log("marker click handler");
                })
        .start();

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

            if (this.params.breadcrumbs && this.map.getBounds().contains(L.latLng(pos)))
            {
                this.add_breadcrumb(sensor);
            }

            var marker = this.sensors[sensor_id].marker;
		    marker.moveTo([pos.lat, pos.lng], [1000] );
		    marker.resume();

            // update tooltip and popup
		    marker.setTooltipContent(this.tooltip_content(msg));
		    marker.setPopupContent(this.popup_content(msg));

            this.draw_progress_indicator(sensor);

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

            if (parent.progress_indicators[sensor_id])
            {
                //this.log('draw_progress_indicator removing layer '+sensor_id);
                this.map.removeLayer(this.progress_indicators[sensor_id].layer);
                delete parent.progress_indicators[sensor_id];
            }
        }
    }

    for (var sensor_id in parent.progress_indicators)
    {
        if (parent.progress_indicators.hasOwnProperty(sensor_id))
        {
            //parent.log('(timer) timer_update '+sensor_id);
            parent.draw_progress_indicator(parent.sensors[sensor_id]);
        }
    }
}

this.draw_progress_indicator = function(sensor)
{
    var sensor_id = sensor.msg[this.RECORD_INDEX];

    //this.log('draw_progress_indicator '+sensor_id);

    // Remove old progress indicator
    if (this.progress_indicators[sensor_id])
    {
        //this.log('draw_progress_indicator removing layer '+sensor_id);
        this.map.removeLayer(this.progress_indicators[sensor_id].layer);
    }

    if (sensor.state.old == null || !sensor.state.old)
    {
        var progress_indicator = {};

        var pos = this.get_msg_point(sensor.msg);

        var prev_pos = this.get_msg_point(sensor.prev_msg);

        var distance = get_distance(prev_pos, pos);

        // only update bearing of bus if we've moved at least 40m
        if (distance > this.PROGRESS_MIN_DISTANCE)
        {
            sensor.progress_bearing = get_bearing(prev_pos, pos);
        }

        if (!sensor.progress_bearing)
        {
            sensor.progress_bearing = 0;
        }

        //this.log(sensor_id+' at '+(new Date())+' vs '+msg.received_timestamp);

        var bus_speed = 7; // m/s

        var time_delta = ((new Date()).getTime() - sensor.msg.received_timestamp.getTime()) / 1000;

        var progress_distance = Math.max(20, time_delta * bus_speed);

        //this.log('progress_distance '+sensor_id+' '+Math.round(time_delta*10)/10+'s '+Math.round(progress_distance)+'m';

        progress_indicator.layer = L.semiCircle([pos.lat, pos.lng],
                                                { radius:  progress_distance,
                                                  color: '#05aa05',
                                                  fillOpacity: 0.15,
                                                  dashArray: [5, 8],
                                                  weight: 3
                                                }).setDirection(sensor.progress_bearing,270);

        this.progress_indicators[sensor_id] = progress_indicator;

        progress_indicator.layer.addTo(this.map);
    }
}

// draw a breadcrumb, up to max of CRUMB_COUNT.  After CRUMB_COUNT, we replace a random previous breadcrumb
this.add_breadcrumb = function(sensor)
{
    var pos = this.get_msg_point(sensor.msg);

    var prev_pos = this.get_msg_point(sensor.prev_msg);

    var distance = get_distance(prev_pos, pos);

    // only update bearing of bus if we've moved at least 40m
    if (distance > this.PROGRESS_MIN_DISTANCE)
    {
        var crumb = L.circleMarker([pos.lat, pos.lng], { color: 'blue', radius: 1 }).addTo(this.map);
        if (this.crumbs.length < this.CRUMB_COUNT) // fewer than CRUMB_COUNT so append
        {
            this.crumbs.push(crumb);
        }
        else // replace a random existing crumb
        {
            var index = Math.floor(Math.random() * this.CRUMB_COUNT);
            this.map.removeLayer(this.crumbs[index]);
            this.crumbs[index] = crumb;
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

// return a Leaflet Icon based on a real-time msg
this.create_sensor_icon = function(msg)
{
    var line = '';

    if (msg.LineRef != null)
    {
        line = msg.LineRef;
    }

    var marker_html =  '<div class="marker_label_'+this.icon_size+'">'+line+'</div>';

    var marker_size = new L.Point(30,30);

    switch (this.icon_size)
    {
        case 'L':
            marker_size = new L.Point(45,45);
            break;

        default:
            break;
    }

    return L.divIcon({
        className: 'marker_sensor_'+this.icon_size,
        iconSize: marker_size,
        iconAnchor: L.point(23,38),
        html: marker_html
    });
}

this.tooltip_content = function(msg)
{
    var time = this.get_msg_date(msg);
    var time_str = ("0" + time.getHours()).slice(-2)   + ":" +
                   ("0" + time.getMinutes()).slice(-2) + ":" +
                   ("0" + time.getSeconds()).slice(-2);
    return time_str +
            '<br/>' + msg[this.RECORD_INDEX] +
			'<br/>Line "' + msg['PublishedLineName'] +'"'+
            '<br/>Delay: ' + this.xml_duration_to_string(msg['Delay']);
}

this.popup_content = function(msg)
{
    var time = this.get_msg_date(msg);
    var time_str = ("0" + time.getHours()).slice(-2)   + ":" +
                   ("0" + time.getMinutes()).slice(-2) + ":" +
                   ("0" + time.getSeconds()).slice(-2);
    var sensor_id = msg[this.RECORD_INDEX];
    return time_str +
        '<br/>' + sensor_id +
		'<br/>Line "' + msg['PublishedLineName'] +'"'+
        '<br/>Delay: ' + this.xml_duration_to_string(msg['Delay']);
}

// user has clicked on 'more' in the sensor popup
this.more_content = function(sensor_id)
{
    var sensor = this.sensors[sensor_id];
    var content = JSON.stringify(sensor.msg).replace(/,/g,', ');
    content +=
        '<br/><a href="#" onclick="click_less('+"'"+sensor_id+"'"+')">less</a>';
    return content;
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

*/

this.log = function() {
    if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('stop_timetable_log') >= 0) {
        console.log.apply(console, arguments);
    }
};

/*

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

// Draw a stop on the map
//
this.draw_stop = function(stop_id)
{
    var stop = this.stop_id_to_stop(stop_id);

    L.marker([stop.lat, stop.lng],
             {icon: this.bus_stop_icon})
     .addTo(this.map);
}

*/

// return provided JS Date() as HH:MM:SS
this.hh_mm_ss = function(datetime)
{
    var hh = ('0'+datetime.getHours()).slice(-2);
    var mm = ('0'+datetime.getMinutes()).slice(-2);
    var ss = ('0'+datetime.getSeconds()).slice(-2);
    return hh+':'+mm+':'+ss;
}


this.log("Instantiated StopBusMap", container, params);

// END of 'class' StopTimetable
}

