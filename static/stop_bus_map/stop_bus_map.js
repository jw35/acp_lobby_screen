/* Bus Stop Map Widget for ACP Lobby Screen */

function StopBusMap(container, params) {

    this.container = container;
    this.params = params;

    this.sensors = {};

    this.progress_indicators = {}; // dictionary by VehicleRef

    this.RTMONITOR_URI = 'http://tfc-app2.cl.cam.ac.uk/rtmonitor/sirivm';

    this.OLD_DATA_RECORD = 60; // time (s) threshold where a data record is considered 'old'

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
    // Map globals
    this.ICON_URL = '/static/images/bus-logo.png';


    this.sock = {}; // the page's WebSocket

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
        iconUrl: '/static/images/bus_stop.png',
        iconSize: [15,40],
        iconAnchor: [3,40]
    });

    this.crumbs = []; // array to hold breadcrumbs as they are drawn

    this.init = function() {
        var self = this;

        this.log("Instantiated StopBusMap", container, params);

        var container_el = document.getElementById(container);

        this.log("Running StopBusMap.init", this.container);

        while (container_el.firstChild) {
                container_el.removeChild(container_el.firstChild);
        }

        var title_div = document.createElement('div');
        title_div.setAttribute('class', 'stop_bus_map_title_div');
        title_div.setAttribute('id', this.container+'_title_div');

        var title_text = document.createElement('div');
        title_text.setAttribute('class', 'stop_bus_map_title_text');
        title_text.setAttribute('id', this.container+'_title_text');
        title_text.innerHTML = params.title;

        title_div.appendChild(title_text);

        container_el.appendChild(title_div);

        var map_div = document.createElement('div');
        map_div.setAttribute('class','stop_bus_map_div');
        map_div.setAttribute('id', this.container+'_div');
        container_el.appendChild(map_div);

        this.map = L.map(map_div, { zoomControl:false }).setView([this.params.lat, this.params.lng], this.params.zoom);
        this.map_tiles = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.map);

        this.sock_connect(self);

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

        this.do_load();
    }

    /*this.reload = function() {
        this.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function () {
        var self = this;
        this.log("Running StopBusMap.do_load", this.container);
        this.log("StopBusMapMap.do_load done", this.container);
    }

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
                    parent.sock_send_str('{ "msg_type": "rt_subscribe", '+
                                         '  "request_id": "'+parent.container+'_A", '+
                                         '  "filters": [ { "test": "inside", '+
                                         '                 "lat_key": "Latitude", '+
                                         '                 "lng_key": "Longitude", '+
                                         '                 "points": [ '+
                                         '                            {  "lat": 52.2219, "lng": 0.07537 }, '+
                                         '                            {  "lat": 52.2221, "lng": 0.10554 }, '+
                                         '                            {  "lat": 52.2065, "lng": 0.10576 }, '+
                                         '                            {  "lat": 52.2070, "lng": 0.07490 }'+
                                         '                          ]'+
                                         '              } ]'+
                                         '}'
                                        );

                    return;
                }
                parent.handle_records(e.data);
                };

    parent.sock.onclose = function() {
                parent.log('** socket closed');
                };
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

            this.add_breadcrumb(sensor);

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
    var data_timestamp = this.get_msg_date(sensor.msg); // will hold Date from sensor

    // get current value of sensor.state.old flag (default false)
    var current_old_flag = !(sensor.state.old == null) || sensor.state.old;

    // calculate age of sensor (in seconds)
    var age = (clock_time - data_timestamp) / 1000;

    if (age > this.OLD_DATA_RECORD)
    {
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

this.log = function(str)
{
    if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('stop_bus_map_log') >= 0)
    {
        console.log(str);
    }
}

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

} // end of StopBusMap

