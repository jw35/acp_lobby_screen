Lobby Screen widget Guide v0.2
==============================

This document defines the interface that Lobby Screen widgets need to
implement so that they can be correctly displayed. The
intention behind this interface is for it to be as flexible as possible
while at the same time requiring minimal coupling between the widgets
and the framework that displays them.

The current definition is experimental and subject to further (possibly
major) refinement.

Widget Requirements
===================

1. Each widget has a name by which it is known, for example
`station_board`.

2. All files making up a widget are stored in a directory with the same
name as the widget.

3. Within this directory, the following files will be recognised. All
are optional, but a widget with no files won't do anything!

    1. __`<name>.js`__

        A JavaScript file containing an object definition for the
        widget. If present, this file will be included into any page
        that displays this widget and it's constructor and method called
        as described below.

        This object has the flowing characteristics:

        * Named based on the widget name, but in camel case without
          any '\_' characters - for example `StationBoard`.

        * A constructor which is invoked by `new` and which takes
          two parameters:

          * The DOM `id` of an page element into which the widget's
            content will be placed
          * A JavaScript object containing `name:value` pairs
            representing parameters for a particular instance of the
            widget.

          The constructor may be called before DOM construction is
          complete and so shouldn't reference any DOM objects.

        * Optionally an `init()` method. If present, this will be
          called after
          DOM construction is complete. It will normally arrange
          to
          populate the widget. This method may take responsibility for
          subsequently updating the widget's content, or this could
          be left to the `reload()` method (see below).

        * Optionally a `reload()` method. if present, this will be
          periodically
          called after the widget has been initialised which will
          typically arrange to update the widget's content.

        The JavaScript can assume the availability of the Jquery
        library.

    2. __`<name>.css`__

        A file containing CSS definitions which, if present, will be
        included into any page that displays this widget.

        To avoid name clashes, widgets must associate a class named
        after their name with their outermost element and then prefix
        all CSS rules with this class. For example

        ```
        <div class="station_board">.....</div>

        .station_board { ....; ....; }
        .station_board table { ...; ...; }
        ```

        The page displaying the widget will establish suitable style
        defaults (including a default body font size) which should be
        relied on where possible to help promote visual conformity
        between widgets. Where possible, widget-specific styles should
        use relative dimensions such as ems, rems or percentages so tha
        tthey can adapt (where possible) to different body font sizes
        and display areas.

        widgets are currently displayed on a grid with columns 320px
        wide and rows 255px high.

    3. __`<name>.html`__

        A file containing an HTML fragment which, if present, will be
        included into any page that displays this widget as the initial
        widget content.

4. Other files can be included in the widget directory which can be
referenced by relative URL from elsewhere.

5. The provision or location of additional resources needed by widgets,
such as API endpoints or HTML page fragments, is not covered by this
document.

Widget implementation
=====================

Using this API, widgets can be implemented an a variety of ways:

* A purely static widget can just use HTML and CSS to render its content
and omit the JavaScript file.

* A 'dynamic' widget can render its content using JavaScript in response
to an `init()` call and based on the parameters passed on object
instantiation. It could render all of the content, or update skeleton
content loaded from HTML.

* Content for dynamic widgets could be rendered entirely by JavaScript,
probably based on information retrieved by an API, or could be generated
server-side and substituted into place (e.g. by jQuery's `$
(...).load()` function)

* widgets can take responsibility for updating themselves, perhaps by
invoking `setTimeout()` folowing each render or by real-time push over
web sockets, or can arrange to refresh themselves in response to calls
to a `relaod()` method.

Examples
========

A working example of a Lobby Screen based on this framework is available
at

  <https://github.com/jw35/acp_lobby_screen>

__Note that at present this implementation is not entirely consistent
with the requirements of this document.__

station_board.js
----------------

`station_board` is an example of a widget implemented in JavaScript
which retrieves and displays content rendered server-side. The widget
arranges its own reloads (but has commented-out code to implement a
`reload()` method):

```javascript
/* Station Board widget for ACP Lobby Screen */

function StationBoard(container, params) {

    this.container = container;
    this.params = params;
    console.log("Instantiated StationBoard", container, params);

    this.init = function() {
        console.log("Running Station_board.init", this.container);
        this.do_load();
    }

    /*
    this.reload = function() {
        console.log("Running StationBoard.reload", this.container);
        this.do_load();
    }
    */

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
```

index.html
----------

It's assumed that some web application provides the lobby screens
themselves. It is further assumes that this application maintains a
database that records which panels should appear on which screens,
and which widgets should appear on panel, along with their
positioning, size, and required parameters. The same widget can appear
more than once on a particular panel (presumably with different
parameters).

The application is responsible for rendering HTML pages to implement
each panel, either by tempting them server-side or by building them
dynamically based on a suitable data feed.

An example page, containing multiple instances of the
`station_board` widget:

```html
<!doctype html>

<html>

  <head>
    <title>ACP Lobby Screen</title>

    <!-- jQuery -->
    <script src="https://code.jquery.com/jquery-3.2.1.min.js"
            integrity="sha256-hwg4gsxgFZhOsEEamdOYGBf13FyQuiTwlAQgxVSNgt4="
            crossorigin="anonymous"></script>

    <link rel="stylesheet" href="{{ url_for('static', filename='lobby_screen.css') }}">

    <script src="{{ url_for('static', filename='station_board.js') }}" type="text/javascript"></script>

    <script type="text/javascript">

      var widget = [];

      widget.push(new StationBoard('station_board_1',{'station': 'CBG', 'offset': 0}));
      widget.push(new StationBoard('station_board_2',{'station': 'CMB', 'offset': 0}));
      widget.push(new StationBoard('station_board_3',{'station': 'CBG', 'offset': 0}));
      widget.push(new StationBoard('station_board_4',{'station': 'PAD', 'offset': 0}));

      function reload_widgets () {
        for (var i = 0; i < widget.length; i++) {
          if ('reload' in widget[i]) {
            console.log("Reloading ", widget[i].container);
            widget[i].reload();
          }
          else {
            console.log("Not reloading ", widget[i].container);
          }
        }
      }

      function page_load() {
        for (var i = 0; i < widget.length; i++) {
          console.log("Initing ", widget[i].container);
          widget[i].init();
        }
        setInterval(function() {
          console.log("Running page-level reloader");
          reload_widgets();
        }, 60000)
      }

    </script>

  </head>

  <body onLoad="page_load()">

    <div class="wrapper">
      <div class="container_1_2 col_1 row_1" id="station_board_1"></div>
      <div class="container_1_2 col_2 row_1" id="station_board_2"></div>
      <div class="container_1_2 col_1 row_3" id="station_board_3"></div>
      <div class="container_1_2 col_2 row_3" id="station_board_4"></div>

      <div class="credits">
        <a href="https://www.greatercambridge.org.uk/"><img alt="Greater Cambridge Partnership" src="{{ url_for('static', filename='logo_gccd_112.png') }}"></a>
        <a href="http://www.connectingcambridgeshire.co.uk/smartcamb/"><img alt="Connecting Cambridgshire" src="{{ url_for('static', filename='logo_sc_112.png') }}" ></a>
        <a href="http://www.cam.ac.uk"><img alt="The University of Cambridge" src="{{ url_for('static', filename='logo_uc_112.png') }}"></a>
        <span>Adaptive Cities Platform</span>
      </div>

    </div>

  </body>

</html>
```