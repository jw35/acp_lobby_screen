/* Traffic Map Widget for Twitter Timelines */

function TwitterTimeline(container, params) {

    this.container = container;
    this.params = params;
    console.log("Instantiated TwitterTimeline", container, params);

    this.init = function() {
        console.log("Running TwitterTimeline.init", this.container);
        this.do_load();
    }

    /*this.reload = function() {
        console.log("Running TwitterTimeline.reload", this.container);
        this.do_load();
    }*/

    this.do_load = function myself() {
        var self = this;
        console.log("Running TwitterTimeline.do_load", this.container);
        var container_width = $('#' + this.container).width();
        var container_height = $('#' + this.container).height();
        console.log("TwitterTimeline.do_load (height,width)", container_height, container_width);
        var tag = $('<a class="twitter-timeline" '+
          'data-lang="en" ' + 
          'data-width="' + container_width + '" ' +
          'data-height="' + container_height + '" ' +
          'data-dnt="true" ' +
          'data-link-color="#000000"' +
          'href="https://twitter.com/' + this.params.who + '">Tweets by ' + this.params.who + ' </a>' +
          '<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>');
        $('#' + this.container).empty().append(tag);
        console.log("TwitterTimeline.do_load done", this.container);
    }

}
