/* Weather Widget for ACP Lobby Screen */

/*global $ */

function Weather(container, params) {

    'use strict';

    this.container = container;
    this.params = params;

    this.init = function () {
        this.log("Running init", this.container);
        this.do_load();
    };

    /*this.reload = function() {
        this.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function () {
        this.log("Running Weather.do_load", this.container);
        var self = this,
            url = "widget/weather?location=" + this.params.location +
                " .weather";
        this.log("do_load URI", url);
        this.log("Container", '#' + this.container);
        $('#' + this.container).load(url, function () {
            setTimeout(function () { self.do_load(); }, 60000);
        });
        this.log("do_load done", this.container);
    };

    this.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('weather_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    this.log("Instantiated Weather", container, params);

}