"use strict";

let curGeoPos;
let geo_callback, loc_timeout;


function runCallback() {
	if (geo_callback != undefined && typeof geo_callback == 'function') {
		window.setTimeout(function() {
            geo_callback();
        }, 1);
	}
}

function getCurLocation() {
	return curGeoPos;
}


/**
 * GetLocation, JSDoc from old Test
 * @param {Boolean} geoAccuracy enable high accuracy (i.e. GPS instead of AP)
 * @param {Numeric} geoTimeout maximal timeout before error function is called
 * @param {Numeric} geoMaxAge maximal allowed age in milliseconds
 * @param {Function} callback
 */
function getLocation(geoAccuracy, geoTimeout, geoMaxAge, callback) {
    let ausgabe = document.getElementById("infogeo");
    geo_callback = callback;

    if (!navigator.geolocation) {
        //maybe there is a position in a cookie
        //because the user had been asked for his address
        let coords = getCookie('coords');
        if (coords) {
            let tmpcoords = JSON.parse(coords);
            if (tmpcoords && tmpcoords['lat'] > 0 && tmpcoords['long'] > 0) {
                testVisualization.setLocation(tmpcoords['lat'], tmpcoords['long']);
            }
        } else {
            ausgabe.innerHTML = Lang.getString('NotSupported');
        }

        runCallback();
        return;
    }
    runCallback();
    //var TestEnvironment.getGeoTracker() = new GeoTracker();
    TestEnvironment.getGeoTracker().start(function(successful, error) {
        if (successful !== true) {
            //user did not allow geolocation or other reason
            switch (error.code) {
                case error.PERMISSION_DENIED:
                        ausgabe.innerHTML = Lang.getString('NoPermission');
                        break;
                case error.TIMEOUT:
                        //@TODO: Position is determined...
                        //alert(1);
                        break;
                case error.POSITION_UNAVAILABLE:
                        ausgabe.innerHTML = Lang.getString('NotAvailable');
                        break;
                case error.UNKNOWN_ERROR:
                        ausgabe.innerHTML = Lang.getString('NotAvailable') + "(" + error.code +")";
                        break;
            }
        }
    }, TestEnvironment.getTestVisualization());
}


//Geolocation tracking
let GeoTracker = (function() {
    "use strict";

    let _positions;
    let _clientCallback;
    let _testVisualization = null;

    let _watcher;
    let _firstPositionIsInAccurate;

    function GeoTracker() {
        _positions = [];
        _firstPositionIsInAccurate = false;
    }

    /**
     * Start geolocating
     * @param {Function(Boolean)} callback expects param 'successful' (boolean, ErrorReason) and
     *      is called as soon as there is a result available or the user cancelled
     * @param {TestVisualization} testVisualization optional
     */
    GeoTracker.prototype.start = function(callback, testVisualization) {
        _clientCallback = callback;

        if (testVisualization !== undefined) {
            _testVisualization = testVisualization;
        }

        if (navigator.geolocation) {
            //try to get an rough first position
            navigator.geolocation.getCurrentPosition(function(success) {
                if (_positions.length === 0) {
                    _firstPositionIsInAccurate = true;
                    successFunction(success);
                }
            }, errorFunction, {
                enableHighAccuracy: false,
                timeout: 2000, //2 seconds
                maximumAge: 60000 //one minute
            });
            //and refine this position later
            _watcher = navigator.geolocation.watchPosition(successFunction, errorFunction, {
                enableHighAccuracy: true,
                timeout: Infinity,
                maximumAge: 0 //one minute
            });
        }
        else {
            let t = _clientCallback;
            _clientCallback = null;
            t(false);
        }

        //call at latest after 2 seconds
    };

    /**
     * Saves the given result
     * Is called when a geolocation query returns a result
     * @param {Position} position the result https://developer.mozilla.org/en-US/docs/Web/API/Position
     */
    let successFunction = function(position) {
        //rough first position and now more accurate one -> remove the inaccurate one
        if (_positions.length === 1 && _firstPositionIsInAccurate) {
            _positions = [];
            _firstPositionIsInAccurate = false;
        }

        _positions.push({
            geo_lat: position.coords.latitude,
            geo_long: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude ,
            bearing: position.coords.heading,
            speed: position.coords.speed,
            tstamp: position.timestamp,
            provider: 'Browser'
        });
        if (_clientCallback !== null) {
            //call client that we now have a result
            let t = _clientCallback;
            _clientCallback = null;
            t(true);
        }
        if (_testVisualization !== null) {
            _testVisualization.setLocation(position.coords.latitude, position.coords.longitude);
        }
        updateCookie(position);
    };

    let errorFunction = function(reason) {
        //PositionError Object (https://developer.mozilla.org/en-US/docs/Web/API/PositionError)
        if (_clientCallback !== null) {
            //call client that we now have an error
            let t = _clientCallback;
            _clientCallback = null;
            t(false, reason);
        }
    };

    let updateCookie = function(position) {
        let coords = {};
        coords['lat'] = position.coords.latitude;
        coords['long'] = position.coords.longitude;
        coords['accuracy'] = position.coords.accuracy;
        coords['altitude'] = position.coords.altitude;
        coords['heading'] = position.coords.heading;
        coords['speed'] = position.coords.speed;
        coords['tstamp'] = position.timestamp;
        //console.log("coords: "+coords);
        coords = JSON.stringify(coords);
        //console.log("tmpcoords: "+tmpcoords);
        setCookie('coords', coords, 3600);
    };

    GeoTracker.prototype.stop = function() {
        if (navigator.geolocation) {
            navigator.geolocation.clearWatch(_watcher);
        }
    };

    /**
     *
     * @returns {Array} all results
     */
    GeoTracker.prototype.getResults = function() {
        return _positions;
    };

    return GeoTracker;
})();


/* getCookie polyfill */
if (typeof window.setCookie === 'undefined') {
    window.setCookie = (cookie_name, cookie_value, cookie_exseconds) => {
        //var exdate = new Date();
        //exdate.setDate(exdate.getDate() + cookie_exdays);

        let futuredate = new Date();
        let expdate = futuredate.getTime();
        expdate += cookie_exseconds * 1000;
        futuredate.setTime(expdate);

        //var c_value=escape(cookie_value) + ((cookie_exdays==null) ? ";" : "; expires="+exdate.toUTCString() +";");
        let c_value = encodeURIComponent(cookie_value) + ((cookie_exseconds==null) ? ";" : "; expires=" + futuredate.toUTCString() + ";");
        document.cookie = cookie_name + "=" + c_value + " path=/;";
    }
}
