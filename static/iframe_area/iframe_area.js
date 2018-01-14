/* Iframe Area Widgit for ACP Lobby Panel */

function IframeArea(container, params) {

    this.container = container;
    this.params = params;
    console.log("Instantiated IframeArea", container, params);

    this.init = function() {
        console.log("Running IframeArea.init", this.container);
        this.do_load();
    }

    /*this.reload = function() {
        console.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function myself() {
        var self = this;
        console.log("Running IframeArea.do_load", this.container);
        var frame = $('<iframe>')
          .attr('src',this.params.url)
          .attr('height', '100%')
          .attr('width', '100%');
        console.log("Frame: ", frame);
        $('#' + this.container).empty().append(frame);
        console.log("StationBoard.do_load done", this.container);
    }

}