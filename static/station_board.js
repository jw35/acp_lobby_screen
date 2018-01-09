/* Station Board Widgit for ACP Lobby Pannel */

function Station_Board(container) {

    this.container = container;
    console.log("Instantiated Ststion Board for " + container)

    this.init = function(params) {
        console.log("Running init for for " + this.container)
        this.params = params;
        this.do_load();
    }

    this.reload = function() {
        console.log("Running reload for for " + this.container)
        this.do_load();
    }

    this.do_load = function myself() {
        console.log("Running do_load for for " + this.container)
        var url = "/station_board?station=" + this.params.station +
          "&offset=" + this.params.offset + " .station_board";
        console.log("URI is " + url)
        $(container).load(url, function() { console.log( "Load was performed." ); setTimeout(myself,10000); });
        console.log("Done load " + url)
    }

}