/* Weather Widget for ACP Lobby Screen */

/*global $ */

function Weather(container, params) {

    'use strict';

    this.container = container;
    this.params = params;
    console.log("Instantiated Weather", container, params);

    this.init = function () {
        console.log("Running init", this.container);
        this.do_load();
    };

    /*this.reload = function() {
        console.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function () {
        console.log("Running Weather.do_load", this.container);
        var self = this,
            url = "widget/weather?location=" + this.params.location +
                " .weather";
        console.log("do_load URI", url);
        console.log("Container", '#' + this.container);
        $('#' + this.container).load(url, function () {
            setTimeout(function () { self.do_load(); }, 60000);
        });
        console.log("do_load done", this.container);
    };

}