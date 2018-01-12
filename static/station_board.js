/* Station Board Widgit for ACP Lobby Panel */

function StationBoard(container, params) {

    this.container = container;
    this.params = params;
    console.log("Instantiated StationBoard", container, params);

    this.init = function() {
        console.log("Running Station_board.init", this.container);
        this.do_load();
    }

    /*this.reload = function() {
        console.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function myself() {
        var self = this;
        console.log("Running StationBoard.do_load", this.container);
        var url = "station_board?station=" + this.params.station +
          "&offset=" + this.params.offset + " .station_board";
        console.log("StationBoard.do_load URI", url);
        console.log("Container", '#' + this.container)
        $('#' + this.container).load(url, function() {
            setTimeout(function() { self.do_load() }, 60000);
        });
        console.log("StationBoard.do_load done", this.container);
    }

}