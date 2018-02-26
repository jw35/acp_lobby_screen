/* Traffic Map Widget for ACP Lobby Screen */

/*global google, document, DEBUG */
/*exported TrafficMap */

function TrafficMap(config, params) {

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

    this.init = function () {
        this.log('Running init', this.container);
        this.do_load();
    };

    /*this.reload = function() {
        this.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function () {
        this.log('Running do_load', this.container);

        var container = document.getElementById(this.container);

        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        var widget_area = document.createElement('div');
        widget_area.classList.add('traffic_map');
        container.appendChild(widget_area);

        var map_area = document.createElement('div');
        map_area.classList.add('map');
        widget_area.appendChild(map_area);

        var title = document.createElement('h1');
        title.classList.add('translucent');
        var img = document.createElement('img');
        img.setAttribute('src', config.static_url + 'car.png');
        title.appendChild(img);
        title.appendChild(document.createTextNode(' '));
        title.appendChild(document.createTextNode('Road Traffic'));
        widget_area.appendChild(title);

        var map, trafficLayer;
        map = new google.maps.Map(map_area, {
            zoom: this.params.zoom,
            center: {lat: this.params.lat, lng: this.params.lng},
            disableDefaultUI: true
        });
        trafficLayer = new google.maps.TrafficLayer({
            autoRefresh: true
        });
        trafficLayer.setMap(map);
        this.log('TragfficMap.do_load done', this.container);

    };

    this.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('traffic_map_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    this.log('Instantiated TrafficMap', this.container, params);

}
