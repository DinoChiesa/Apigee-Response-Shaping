#! /usr/local/bin/node

// provision.js
// ------------------------------------------------------------------
// provision an Apigee API Product, Developer, App, and Cache
// for the field filtering example.
//
// Copyright 2017-2022 Google LLC.
//

/* jshint esversion: 9, strict:implied, node:true */


// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// last saved: <2022-June-06 15:15:00>

const apigeejs   = require('apigee-edge-js'),
      common     = apigeejs.utility,
      apigee     = apigeejs.apigee,
      util       = require('util'),
      path       = require('path'),
      sprintf    = require('sprintf-js').sprintf,
      Getopt     = require('node-getopt'),
      version    = '20220606-1513',
      proxyDir   = path.resolve(__dirname, '../bundle'),
      defaults   = { secretsmap : 'secrets'  },
      getopt     = new Getopt(common.commonOptions.concat([
        ['R' , 'reset', 'Optional. Reset, delete all the assets previously provisioned by this script.'],
        ['', 'secretsmap=ARG', 'optional. name of the KVM in Apigee for keys. Will be created if nec. Default: ' + defaults.secretsmap],
        ['', 'amadeus_client_id=ARG', 'required. client_id for Amadeus test APIs'],
        ['', 'amadeus_client_secret=ARG', 'required. client_secret for Amadeus test APIs'],
        ['e' , 'env=ARG', 'required. the Apigee environment to provision for this example. ']
      ])).bindHelp();

// ========================================================


process.on('unhandledRejection',
            r => console.log('\n*** unhandled promise rejection: ' + util.format(r)));

function insureOneMap(org, r, mapname, encrypted) {
  if (r.indexOf(mapname) == -1) {
    return org.kvms.create({ environment: opt.options.env, name: mapname, encrypted})
      .then( () => r );
  }
  return r;
}

function storeCreds(org) {
  // as of 20220606-1514
  // this will not work in Apigee X !
  return Promise.resolve({})
    .then( _ => org.kvms.put({
        environment: opt.options.env,
        kvm: opt.options.secretsmap,
        key: 'amadeus_test_client_id',
        value: opt.options.amadeus_client_id
      }))
    .then( _ => org.kvms.put({
        environment: opt.options.env,
        kvm: opt.options.secretsmap,
        key: 'amadeus_test_client_secret',
        value: opt.options.amadeus_client_secret
    }));
}

function importAndDeploy(org) {
  return Promise.resolve({})
    .then(_ => org.proxies.import({source:proxyDir}))
    .then( result => org.proxies.deploy({name:result.name, revision:result.revision, environment:opt.options.env }) );
}

console.log(
  `Apigee Response Shaping Example Provisioning tool, version: ${version}\n` +
    `Node.js ${process.version}\n`);

common.logWrite('start');
let opt = getopt.parse(process.argv.slice(2));
common.verifyCommonRequiredParameters(opt.options, getopt);

if ( ! opt.options.env) {
  console.log('you must specify an environment.');
  getopt.showHelp();
  process.exit(1);
}

if ( ! opt.options.reset) {
  if ( ! opt.options.amadeus_client_id) {
    opt.options.amadeus_client_id = process.env.amadeus_client_id;
  }
  if ( ! opt.options.amadeus_client_secret) {
    opt.options.amadeus_client_secret = process.env.amadeus_client_secret;
  }
  if ( ! opt.options.amadeus_client_id || !opt.options.amadeus_client_secret) {
    console.log('you must specify credentials for Amadeus test APIs.');
    getopt.showHelp();
    process.exit(1);
  }
}

if ( ! opt.options.secretsmap) {
  console.log('defaulting to secrets map: ' + defaults.secretsmap);
  opt.options.secretsmap = defaults.secretsmap;
}

const constants = {
        discriminators : {
          //cache        : 'cache1',
          proxy        : 'response-shaping',
          product      : 'Response-Shaping-Example-Product',
          developer    : 'Response-Shaping-Developer@example.com',
          developerapp : 'Response-Shaping-App-'
        },
        descriptions : {
          product      : 'Test Product for Response Shaping Example',
          app          : 'Test App for Response Shaping Example'
        },
        note           : 'created '+ (new Date()).toISOString() + ' for Response-Shaping Example',
        appExpiry      : '210d'
      },
      response_filters = {
        product: "include:data.name,data.iataCode,data.address.cityName,data.address.stateCode",
        app: [
          "include:data.type,data.id,data.self.href,data.iataCode,data.name",
          "exclude:meta,data.type,data.address,data.self,data.detailedName,data.analytics"
        ]
      };

apigee.connect(common.optToOptions(opt))
  .then( org => {
    common.logWrite('connected');
    if (opt.options.reset) {
      let delOptions = {
            app1: { appName: constants.discriminators.developerapp + 1, developerEmail: constants.discriminators.developer },
            app2: { appName: constants.discriminators.developerapp + 2, developerEmail: constants.discriminators.developer },
            developer:  { developerEmail: constants.discriminators.developer },
            product : { productName: constants.discriminators.product },
            proxy : { name: constants.discriminators.proxy }
          };

      return Promise.resolve({})
        .then( _ => org.developerapps.del(delOptions.app1).catch( _ => {}) )
        .then( _ => org.developerapps.del(delOptions.app2).catch( _ => {}) )
        .then( _ => org.developers.del(delOptions.developer).catch( _ => {}) )
        .then( _ => org.products.del(delOptions.product).catch( _ => {}) )
        .then( _ =>
               org.proxies.get( delOptions.proxy )
               .then( proxy => {
                 //console.log('GET proxy : ' + JSON.stringify(proxy));
                 return org.proxies.getDeployments( delOptions.proxy )
               .then( deployments =>
                   org.proxies.undeploy({
                      ...delOptions.proxy,
                      environment: deployments.environment[0].name,
                      revision:deployments.environment[0].revision[0].name
                   }));
               })
               .then( _ => org.proxies.del( delOptions.proxy ).catch( _ => {}) )
               .catch( _ => {}) )
        .then( _ => common.logWrite(sprintf('ok. demo assets have been deleted')) );
    }

    let options = {
          products: {
            creationOptions: () => ({
              productName  : constants.discriminators.product,
              description  : constants.descriptions.product,
              proxies      : [constants.discriminators.proxy],
              attributes   : { access: 'public', note: constants.note, response_filter: response_filters.product },
              approvalType : 'auto'
            })
          },
          developers: {
            creationOptions: () => ({
              developerEmail : constants.discriminators.developer,
              lastName       : 'Developer',
              firstName      : 'Response-Shaping-Example',
              userName       : 'Response-Shaping-Example-Developer',
              attributes     : { note: constants.note }
            })
          },
          developerapps: {
            getOptions: {
              developerEmail : constants.discriminators.developer
            },
            nameResolver   : (x) => constants.discriminators.developerapp + x,
            creationOptions: (x) => ({
              appName        : constants.discriminators.developerapp + x,
              developerEmail : constants.discriminators.developer,
              productName    : constants.discriminators.product,
              description    : constants.descriptions.app,
              expiry         : '210d',
              attributes     : { access: 'public', note: constants.note, response_filter: response_filters.app[x - 1]}
            })
          }
        };

    function conditionallyCreateEntity(entityType, ix) {
      let collectionName = entityType + 's';
      return org[collectionName].get(options[collectionName].getOptions || {})
        .then( result => {
          let itemName = options[collectionName].nameResolver ?
            options[collectionName].nameResolver(ix) :
            constants.discriminators[entityType];
          if (result.indexOf(itemName)>=0) {
            if (collectionName == 'developerapps') {
              return org[collectionName].get({
                developerEmail : constants.discriminators.developer,
                appName        : itemName
              });
            }
            return Promise.resolve(result) ;
          }

          return org[collectionName].create(options[collectionName].creationOptions(ix));
        });
    }

    return Promise.resolve({})
      .then( _ => org.kvms.get({ environment: opt.options.env }))
      .then( r => insureOneMap(org, r, opt.options.secretsmap, true))
      .then( r => storeCreds(org))
      //.then( _ => conditionallyCreateEntity('cache'))
      .then( _ => importAndDeploy(org))
      .then( _ => conditionallyCreateEntity('product'))
      .then( _ => conditionallyCreateEntity('developer'))
      .then( _ => conditionallyCreateEntity('developerapp', 1))
      .then( app1 =>
             conditionallyCreateEntity('developerapp', 2)
             .then( app2 => {
               console.log();
               console.log(sprintf('app1_client_id=%s', app1.credentials[0].consumerKey));
               console.log(sprintf('app2_client_id=%s', app2.credentials[0].consumerKey));
               console.log();
             }))
      .then( _ => {
        console.log('curl -i -X GET "https://$ORG-$ENV.apigee.net/response-shaping/iata-t1/SEATTLE" -H apikey:$app1_client_id');
        console.log('curl -i -X GET "https://$ORG-$ENV.apigee.net/response-shaping/iata-t2/SEATTLE" -H apikey:$app1_client_id');
        console.log('curl -i -X GET "https://$ORG-$ENV.apigee.net/response-shaping/iata-t2/SEATTLE" -H apikey:$app2_client_id');
        console.log('curl -i -X GET "https://$ORG-$ENV.apigee.net/response-shaping/iata-t3/SEATTLE" -H apikey:$app1_client_id');
        console.log();
      });
  })
  .catch( e => console.log(util.format(e)) );
