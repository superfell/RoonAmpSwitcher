"use strict";

// add timestamps in front of log messages
require('console-stamp')(console, {
    label: false,
    labelPrefix: "",
    labelSuffix: "",
    datePrefix: "",
    dateSuffix: "",
});

const triggerHost = "amp.local"
const triggerPort = 9090

const turnOnPause = 35 * 1000   // 35 seconds
const zoneName = "Cave"

let RoonApi = require("node-roon-api");
let RoonApiStatus = require("node-roon-api-status");
let RoonApiTransport = require("node-roon-api-transport");
let ontime = require('ontime')
let net = require('net');

let trigger_state = "UNKNOWN"
let last_trigger_write = new Date();

let roon = new RoonApi({
    extension_id:        'com.superfell.roon.amp',
    display_name:        "Roon Power Amp Switcher",
    display_version:     "1.0.1",
    publisher:           'Simon Fell',
    email:               'fellforce@.gmail.com',
    website:             'https://github.com/superfell/',
    log_level:           'none',
    
    core_paired: function(core) {
            let transport = core.services.RoonApiTransport;
            let tracker = new_tracker(core, transport);
            transport.subscribe_zones(tracker.zone_event);
        },

        core_unpaired: function(core) {
            console.log("-", "LOST");
        }
});

// get current state at startup, ensure we have the state before we start
// processing events from Roon.
amp_trigger_msg('STAT', function(data) {
    trigger_callback(data);
    roon.start_discovery();
})

let svc_status = new RoonApiStatus(roon);

roon.init_services({
    required_services: [ RoonApiTransport ],
    provided_services: [ svc_status ],
});

svc_status.set_status("All is good", false);

function new_tracker(core, transport) {
    let t = {
        zone: null,
        zone_id: "",
        last_state : "",
    }
    
    t.on_state_changed = function() {
        console.log("zone state now " + t.last_state)
        if (!((t.last_state != "playing") && (t.last_state != "loading"))) {
            if (trigger_state == "OFF") {
                transport.control(t.zone, "pause", (x) => setTimeout(() => transport.control(t.zone, "play"), turnOnPause))
            }
            set_trigger(true)
        }
    }
        
    t.zone_event = function(cmd, data) {
        if (cmd == "Subscribed") {
            data.zones.forEach( z => { 
                if (z.display_name == zoneName) {
                    t.zone = z;
                    t.zone_id = z.zone_id;
                    t.last_state = z.state;
                }
            })
            console.log("zones", t.zone_id, t.last_state);
            t.on_state_changed();
            
        } else if (cmd == "Changed") {
            if ("zones_changed" in data) {
                data.zones_changed.forEach( z => {
                    if ((z.zone_id == t.zone_id) && (z.state != t.last_state)) {
                        t.last_state = z.state;
                        t.on_state_changed();
                    }
                })
            } else if ("zones_seek_changed" in data) {
                // skip
            } else {
                console.log(cmd, data);
            }
        }
    }
    return t
}

// time is in UTC
ontime({
    cycle: '07:10:00'
}, function (ot) {
    console.log('Scheduled: turning amp off')
    set_trigger(false)
    ot.done()
    return
})

// update the trigger state to the new state (true/false for on/off)
function set_trigger(newStateBool) {
    let newState = newStateBool ? "ON" : "OFF";
    if (newState == trigger_state) {
        // If we think we're not going to make a change, and we've talked to the trigger
        // recently, skip doing this
        if ((new Date().getTime() - last_trigger_write.getTime()) < 10000) {
            console.log("skipping no-op trigger change of: " + newState + ", current state is: " + trigger_state);
            return;
        }
    }
    amp_trigger_msg(newStateBool ? 'UON ': 'UOFF', trigger_callback);
}

const trigger_on = Buffer.from('ON  ')

function trigger_callback(data) {
    let new_state = data.compare(trigger_on, 0,4,0,4) == 0 ? "ON" : "OFF"
    console.log("Trigger state was " + trigger_state + " now " + new_state);
    trigger_state = new_state;
    svc_status.set_status("Amp Power: " + new_state, false);
}


// amp_trigger_msg is a helper that will send 'msg' to the esp2866 controlling the amp trigger singal
// and pass the response to the callback.
function amp_trigger_msg(msg, callback) {
    console.log("starting amp_trigger_msg:" + msg)
    last_trigger_write = new Date();
    
    var client = new net.Socket();    
    client.connect(triggerPort, triggerHost, function() {
        // Write a message to the socket as soon as the client is connected, the server will receive it as message from the client 
        client.write(msg);
    });

    // Add a 'data' event handler for the client socket
    // data is what the server sent to this socket
    client.on('data', function(data) {
        console.log('TRIGGER SAID: ' + data.slice(0,4));
        // Close the client socket completely
        client.destroy();
        callback(data)
    });
}
