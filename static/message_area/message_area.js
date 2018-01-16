/* Message Area Widget for ACP Lobby Screen */

/*global $ */

'use strict';

function MessageArea(container, params) {

    this.container = container;
    this.params = params;
    console.log("Instantiated MessageArea", container, params);

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
        $('#' + this.container).html('<div class="message_area">' + params.message + '</div>');
        console.log("do_load done", this.container);
    };

}