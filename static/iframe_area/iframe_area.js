/* Iframe Area Widget for ACP Lobby Screen */

/*global $ */

function IframeArea(container, params) {

    'use strict';

    this.container = container;
    this.params = params;

    this.init = function () {
        this.log("Running init", this.container);
        this.do_load();
    };

    this.reload = function () {
        this.log("Running reload", this.container);
        $('#' + this.container + ' iframe').attr("src", this.params.url);
    };

    this.do_load = function () {
        this.log("Running do_load", this.container);
        var frame = $('<iframe>')
                .attr('src', this.params.url)
          // 'scrolling=no' is deprecated but I can't find a cosponsoring CSS attribute
                .attr('scrolling', 'no')
                .addClass('iframe_area');
        this.log("Frame: ", frame);
        $('#' + this.container).empty().append(frame);
        this.log("do_load done", this.container);
    };

    this.log = function() {
        if ((typeof DEBUG !== 'undefined') && DEBUG.indexOf('iframe_area_log') >= 0) {
            console.log.apply(console, arguments);
        }
    };

    this.log("Instantiated IframeArea", container, params);

}