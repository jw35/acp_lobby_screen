/* Message Area Widget for ACP Lobby Screen */

/*global $ */

'use strict';

function MessageArea(config, params) {

    this.config = config;
    this.container = config.container;   // For backwards compatibility
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
        this.log("Running do_load", this.container);
        $('#' + this.container).html(
            '<div class="message_area">' +
            '<h1>' +
            '<img src="' + config.static_url + 'black-bubble-speech.png" alt=""> '+
            params.title +
            '</h1>' +
            params.message +
            '</div>');
        this.log("do_load done", this.container);
    };

    this.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('message_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    this.log("Instantiated MessageArea", this.container, params);

}