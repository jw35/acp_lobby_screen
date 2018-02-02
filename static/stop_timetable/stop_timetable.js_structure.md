stop_timetable.js structure
===========================

init:
    sets up container structure
    loads this stop into stops_cache
    calls get_stop_journeys:
        calls API journey_by_time_and_stop
        on ready:
            calls add_aip_stop_data:
                foreach retrieved journey:
                    push departure/line into stops_cache[stop].departures
                    push list of stops served into stops_cache[stop].journeys
                    add each stop to stops_cache if missing
            calls update_stop:
                calls draw_departures:
                    Append all line/time pairs to departure_div