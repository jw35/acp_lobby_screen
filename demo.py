#!/usr/bin/env python3

import zeep
import re
import os

TOKEN=os.environ["NRE_TOKEN"]
WSDL = 'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/wsdl.aspx?ver=2017-10-01'

client = zeep.Client(wsdl=WSDL)
data = client.service.GetDepBoardWithDetails(numRows=50,crs="CBG",_soapheaders={"AccessToken":TOKEN},timeOffset=30)

#print(data)

#print("Train departures for {0} (updated {1})".format(
#    data["locationName"],
#    data["generatedAt"].strftime("%H:%M")))
#print()

#if data["nrccMessages"]:
#    for message in data["nrccMessages"]["message"]:
#        for key in message:
#            text = message[key]
#            text = re.sub(r'<A.*?>(.*?)</A>',r'\1',text)
#            text = re.sub(r'<P>','\n',text)
#            print(text)
#    print()


for service in data["trainServices"]["service"]:

    print(service)

    print(service["serviceID"])

    service_details = client.service.GetServiceDetails(serviceID=service["serviceID"])

    print(service_details)

#    print("{0:5s}  {1:30s}  {2:10s}  {3:2s}".format(
#        service["std"], 
#        service["destination"]["location"][0]["locationName"], 
#        service["etd"], 
#        service["platform"] if service["platform"] else ''))
    #if service["cancelReason"]:
    #    print("   {0}".format(service["cancelReason"]))
    #elif service["delayReason"]:
    #    print("   {0}".format(service["delayReason"]))
#    if "subsequentCallingPoints" in service and service["subsequentCallingPoints"]:
#        print("  Calling at: ", end="")
#        for callingpoint in service["subsequentCallingPoints"]["callingPointList"][0]["callingPoint"]:
#            print("{0} ({1}) ".format(callingpoint["locationName"], callingpoint["st"]),end="")
#        print()

#print()
#print("Powered by National Rail Enquires (http://www.nationalrail.co.uk/)")

