# Response Shaping: Including or excluding fields from responses

This is an example proxy that illustrates how to use Apigee to shape
data from JSON responses, dynamically based on the API Product or the Developer App.

How it works: the Apigee Proxy retrieves a JSON response from the upstream system; that
response includes a set of fields or properties. The proxy gets a list of field
names to include or exclude from the response, from the metadata attached to
either the API Product or the Developer App. The proxy then applies that filtering dynamically.

This is a handy pattern for building adaptable facades for APIs.

It also supports the idea of allowing developers of apps to specify the fields
they want to include or exclude in responses to their apps.

## License

This example and all its code and configuration
is Copyright (c) 2017-2019 Google LLC, and is released under the
Apache Source License v2.0. For information see the [LICENSE](LICENSE) file.

## Disclaimer

This example is not an official Google product, nor is it part of an official Google product.

## Screencast Explanation

[![Screenshot of demo
screencast](img/Response_Shaping_in_Apigee_Edge.png)](https://youtu.be/BfL-bxRtjug "Response Shaping Demonstration")

## Let's talk about Service Facades

We sometimes speak of the concept of a "Service Facade" - this means that the Apigee Edge proxy that you configure, modifies the response from the backend in some way, so that each app sending requests through Edge might see a _different_, **modified** response. This could mean different verb + resource pairs, different formats (transforming XML to JSON), or different payloads. It could also mean "server side mashups" where the API exposed from Edge calls multiple backend systems.

## OK, What is Response Shaping?

Within the realm of Service Facade, sometimes you just want to change the response payload. Specifically the backend may return a very large payload, and you'd like to winnow it down to the minimum required for the App, or for the API Product you're exposing.

There's an interesting alternative to REST called [GraphQL](http://graphql.org/), which does some of this. But GraphQL changes the basic metaphor of the API.  As a simpler alternative, one might look at the [StackExchange API](https://api.stackexchange.com/docs) and the concept of [custom filters](https://api.stackexchange.com/docs/filters).

Wouldn't it be nice to be able to filter data like that for any API?  Maybe it's a healthcare scenario and you want to eliminate some information for privacy purposes. Maybe it's a retail scenario and you want to eliminate internal part numbers or inventory-on-hand information. Maybe it's just because the client is a mobile app and you want to economize on the payload size.

We can call the general approach "Response Shaping" or "Field Filtering", and you can do it within Apigee. Very easily! This code repo provides an example that you can use, and extend or apply to your own scenario.

The logic for filtering fields (include or exclude) from a JSON hash is provided in a JavaScript callout - a bit of custom JavaScript that runs within an Apigee policy.

There is one interesting method:

```
 function applyFieldFilter(action, obj, fields) {...}

   @action : 'include' or 'exclude'
   @obj : a JS hash
   @fields: an array of strings, referring to fields within the hash
```

### Example 1: The Basics

Assume a JS hash like this:
```json
{
  "prop1" : 7,
  "prop2" : [ 1, 2, 3, 4],
  "prop3" : {
    "key1" : "A",
    "key2" : null,
    "key3" : true
  }
}
```

With action = 'include' and the fields array like this:
`['prop1', 'prop3.key1']` ...the output will be a hash like so:

```json
{
  "prop1" : 7,
  "prop3" : {
    "key1" : "A"
  }
}
```

### Example 1a: GraphQL expression

The same result can be achieved using a GraphQL expression. The equivalent to
the above example is:
`"{ prop1 prop3 { key1 } }"`


### Example 2: Arrays

Assume a JS hash like this:

```json
{
  "prop1" : 7,
  "prop2" : [ 1, 2, 3, 4],
  "data" : [{
    "key1" : "A",
    "key2" : null,
    "key3" : true
  },{
    "key1" : "B",
    "key2" : "alpha",
    "key3" : false
  },{
    "key1" : "C",
    "key2" : "yertle",
    "key3" : false
  }]
}
```

With action = 'include' and the fields array like this:
`['prop2', 'data.key1']` ...the output will be:

```json
{
  "prop2" : [ 1, 2, 3, 4],
  "data" : [{
    "key1" : "A"
  },{
    "key1" : "B",
  },{
    "key1" : "C",
  }]
}
```

### Example 3: Arrays and excluding

Assume the same JS hash as above. With action = 'exclude' and the fields array like this:
`['prop2', 'data.key1']` ...the output will be:

```json
{
  "prop1" : 7,
  "data" : [{
    "key2" : null,
    "key3" : true
  },{
    "key2" : "alpha",
    "key3" : false
  },{
    "key2" : "yertle",
    "key3" : false
  }]
}
```


## Pre-requisites for the Demo

To install and use this example yourself, on your own Apigee Edge organization,
you should clone this repo, and have a bash shell.
You should also (obviously?) have orgadmin rights to a cloud-based Edge organization.

## The Demonstrations Available Here

There are a variety of API Requests in the API proxy.
For all of them, the APIKey must be passed in the header "APIKEY".

The requests follow this form:
`GET /response-shaping/PATH/CITY`

...where PATH is replaced by one of
{ `iata-t1` , `iata-t2` , `iata-t3` }
and CITY is a name like SEATTLE or DENVER.

Each request retrieves information about  Airports near a surrounding city. The actual backing service is a publicly-accessible [test service, provided by Amadeus](https://developers.amadeus.com/self-service/category/air/api-doc/airport-and-city-search/api-reference).

In the PATH,
* t1 implies no filtering
* t2 filters based on the custom attribute on the Client (Developer App)
* t3 filters based on the custom attribute on the API Product

### Examples

* `GET /response-shaping/iata-t1/SEATTLE`
* `GET /response-shaping/iata-t2/SEATTLE`
* `GET /response-shaping/iata-t3/SEATTLE`


## Provisioning the Easy Way


The easy way to prepare to run this demonstration is to use the
[provision.js](./tools/provision.js) script to provision the api proxy, api
products, and developer apps necessary.

But before you do that, you need credentials from Amadeus for their test
APIs. To get them, visit [the Amadeus developer
portal](https://developers.amadeus.com/self-service),
and click "REGISTER" in the upper right hand corner of the screen. Confirm your
account, register an app, and get the API Key and Secret.

Then, provision Apigee:

```
cd tools
npm install
AMADEUS_CLIENT_ID=apikey_from_amadeus
AMADEUS_CLIENT_SECRET=api_secret_from_amadeus
ORG=myorg
ENV=test
node ./provision.js  -v -n -o $ORG -e $ENV \
   --amadeus_client_id=${AMADEUS_CLIENT_ID} \
   --amadeus_client_secret=${AMADEUS_CLIENT_SECRET}
```

The output of that script will include lines like this:

```
app1_client_id=8yyAnp3QB5KbFXX0Pj2GqNzvVbrPdOV1
app2_client_id=uOCeDqDL7ZfKGIW068Al710PHZif9jcJ

curl -i -X GET "https://$ORG-$ENV.apigee.net/response-shaping/iata-t1/SEATTLE" -H apikey:$app1_client_id
curl -i -X GET "https://$ORG-$ENV.apigee.net/response-shaping/iata-t2/SEATTLE" -H apikey:$app1_client_id
curl -i -X GET "https://$ORG-$ENV.apigee.net/response-shaping/iata-t2/SEATTLE" -H apikey:$app2_client_id
curl -i -X GET "https://$ORG-$ENV.apigee.net/response-shaping/iata-t3/SEATTLE" -H apikey:$app1_client_id
```

Copy-paste the lines to set the app1_client_id and app2_client_id:
```
app1_client_id=8yyAnp3QB5KbFXX0Pj2GqNzvVbrPdOV1
app2_client_id=uOCeDqDL7ZfKGIW068Al710PHZif9jcJ
```

Then, Start a trace session in Apigee, and invoke the proxy to see unfiltered results:
```
curl -i -X GET "https://$ORG-$ENV.apigee.net/response-shaping/iata-t1/SEATTLE" -H apikey:$app1_client_id
```

results shaped based on client id:
```
curl -i -X GET "https://$ORG-$ENV.apigee.net/response-shaping/iata-t3/SEATTLE" -H apikey:$app1_client_id
```

and results shaped based on app product:
```
curl -i -X GET "https://$ORG-$ENV.apigee.net/response-shaping/iata-t3/SEATTLE" -H apikey:$app1_client_id
```

View the trace session to examine the various effects of the policies.

