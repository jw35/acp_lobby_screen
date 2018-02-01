#!/bin/bash

# Find journeys with journeys_by_time_and_stop and then extract selected 
# details about them with journey

for j in $(coreapi action journeys_by_time_and_stop list -p stop_id=0500CCITY424  | jq '.results | sort_by(.time) | .[] | .journey');
do
  coreapi action journey read -p id=$j | \
  jq '{ id, days_of_week, nonoperation_bank_holidays, operation_bank_holidays, jp_regular_days: .journey_pattern.route.line.regular_days_of_week, jp_bh: .journey_pattern.route.line.bank_holiday_operation, jp_start: .journey_pattern.route.line.start_date, jp_end: .journey_pattern.route.line.end_date }'
done
