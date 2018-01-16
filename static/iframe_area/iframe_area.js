/* Iframe Area Widget for ACP Lobby Screen */

/*global $ */

function IframeArea(container, params) {

    'use strict';

    this.container = container;
    this.params = params;
    console.log("Instantiated IframeArea", container, params);

    this.init = function () {
        console.log("Running init", this.container);
        this.do_load();
    };

    this.reload = function () {
        console.log("Running reload", this.container);
        $('#' + this.container + ' iframe').attr("src", this.params.url);
    };

    this.do_load = function () {
        console.log("Running do_load", this.container);
        var frame = $('<iframe>')
                .attr('src', this.params.url)
          // 'scrolling=no' is deprecated but I can't find a cosponsoring CSS attribute
                .attr('scrolling', 'no')
                .addClass('iframe_area');
        console.log("Frame: ", frame);
        $('#' + this.container).empty().append(frame);
        console.log("do_load done", this.container);
    };

}