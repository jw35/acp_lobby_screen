/* Traffic Map Widget for ACP Lobby Screen */

/*global $, google, document */

function TrafficMap(container, params) {

    'use strict';

    this.container = container;
    this.params = params;
    console.log("Instantiated TrafficMap", container, params);

    this.init = function () {
        console.log("Running init", this.container);
        this.do_load();
    };

    /*this.reload = function() {
        console.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function () {
        console.log("Running do_load", this.container);
        var map, trafficLayer;
        map = new google.maps.Map(document.getElementById(this.container), {
            zoom: this.params.zoom,
            center: {lat: this.params.lat, lng: this.params.lng},
            disableDefaultUI: true
        });
        trafficLayer = new google.maps.TrafficLayer({
            autoRefresh: true
        });
        trafficLayer.setMap(map);
        console.log("TragfficMap.do_load done", this.container);
    };

}
