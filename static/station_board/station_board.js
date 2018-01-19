/* Station Board Widget for ACP Lobby Screen */

/*global $ */

function StationBoard(container, params) {

    'use strict';

    this.container = container;
    this.params = params;
    console.log("Instantiated StationBoard", container, params);

    this.init = function () {
        console.log("Running init", this.container);
        this.do_load();
    };

    /*this.reload = function() {
        console.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function () {
        console.log("Running StationBoard.do_load", this.container);
        var self = this,
            url = "widget/station_board?station=" + this.params.station +
                "&offset=" + this.params.offset + " .station_board";
        console.log("do_load URI", url);
        console.log("Container", '#' + this.container);
        $('#' + this.container).load(url, function () {
            setTimeout(function () { self.do_load(); }, 60000);
        });
        console.log("do_load done", this.container);
    };

}