/* Message Area Widget for ACP Lobby Screen */

function MessageArea(container, params) {

    this.container = container;
    this.params = params;
    console.log("Instantiated MessageArea", container, params);

    this.init = function() {
        console.log("Running MesageArea.init", this.container);
        this.do_load();
    }

    /*this.reload = function() {
        console.log("Running StationBoard.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function myself() {
        var self = this;
        console.log("Running MessageArea.do_load", this.container);
        $('#' + this.container).html('<div class="message_area">' + params.message + '</div>');
        console.log("StationBoard.do_load done", this.container);
    }

}