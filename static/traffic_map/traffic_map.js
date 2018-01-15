/* Traffic Map Widgit for ACP Lobby Screen */

function TrafficMap(container, params) {

    this.container = container;
    this.params = params;
    console.log("Instantiated TrafficMap", container, params);

    this.init = function() {
        console.log("Running TrafficMap.init", this.container);
        this.do_load();
    }

    /*this.reload = function() {
        console.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function myself() {
        var self = this;
        console.log("Running TrafficMap.do_load", this.container);
        var map = new google.maps.Map(document.getElementById(this.container), {
          zoom: this.params.zoom,
          center: {lat: this.params.lat, lng: this.params.lng},
          disableDefaultUI: true
        });
        var trafficLayer = new google.maps.TrafficLayer({
            autoRefresh: true
        });
        trafficLayer.setMap(map);
        console.log("TragfficMap.do_load done", this.container);
    }

}
