// clear previous values
function clearFields() {
    $('#title').val('');
    $('#id').val('');
    $('#allDay').prop('checked', false);
}

dirname = function(path) {
    return path.replace(/\\/g, '/').replace(/\/[^\/]*\/?$/, '');
}

// build the full path up to the calendar resource
// granularity: year/month/day/
function getCalPath(day, granularity, resource) {
    var path = window.location.protocol+'//'+
            window.location.host+
            dirname(window.location.pathname);

    path += (granularity)?$.fullCalendar.formatDate(day, granularity)+resource:'/'+resource;
    
    return path;
}

// Load calendar data from user storage
var calEvents = []; // store all events
function loadRemote(eventsURI) {
    var g = $rdf.graph();
    var f = $rdf.fetcher(g);
    // add CORS proxy
    $rdf.Fetcher.crossSiteProxyTemplate="https://example.com/proxy?uri={uri}";
    
    // fetch user data
    f.nowOrWhenFetched(eventsURI,undefined,function(){
        // get all event IDs
        t = g;
        var evs = g.statementsMatching(undefined, 
                    $rdf.sym('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), 
                    undefined, 
                    $rdf.sym(eventsURI));

        for (var e in evs) {
            var ev = g.statementsMatching(evs[e]['subject']);
            var EVENTS  = $rdf.Namespace('http://purl.org/NET/c4dm/event.owl#');
            var TIME = $rdf.Namespace('http://purl.org/NET/c4dm/timeline.owl#');
            var DC = $rdf.Namespace('http://purl.org/dc/elements/1.1/');
            var FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
            var UI = $rdf.Namespace('http://www.w3.org/ns/ui#');

            var id = evs[e]['subject']['value'];
            var start = g.anyStatementMatching(evs[e]['subject'], TIME('start'));
            var end = g.anyStatementMatching(evs[e]['subject'], TIME('end'))
            var title = g.anyStatementMatching(evs[e]['subject'], DC('title'));
            var color = g.anyStatementMatching(evs[e]['subject'], UI('color'));
            var maker = g.anyStatementMatching(evs[e]['subject'], FOAF('maker'));
            var allDay = g.anyStatementMatching(evs[e]['subject'], TIME('allDay'))

            var event = {
                id: id.slice(id.indexOf('#'), id.length),
                start: (start)?$.fullCalendar.parseISO8601(start['object']['value']):undefined,
                end: (end)?$.fullCalendar.parseISO8601(end['object']['value']):undefined,
                allDay: (allDay)?true:false,
                title: (title)?title['object']['value']:undefined,
                color: (color)?color['object']['value']:undefined,
                maker: (maker)?maker['object']['value']:undefined
            };
            calEvents.push(event);
        }
        
    /*
        var query = "PREFIX event: <http://purl.org/NET/c4dm/event.owl#> \n"+
            "PREFIX timeline: <http://purl.org/NET/c4dm/timeline.owl#> \n"+
            "PREFIX dc: <http://purl.org/dc/elements/1.1/> \n"+
            "PREFIX foaf: <http://xmlns.com/foaf/0.1/> \n"+
            "PREFIX ui: <http://www.w3.org/ns/ui#> \n"+
            "SELECT * \n"+
            "WHERE {\n"+
            "  ?e a event:Event . \n"+
            "  OPTIONAL { ?e timeline:start ?start . } \n"+
            "  OPTIONAL { ?e timeline:end ?end . } \n"+
            "  OPTIONAL { ?e timeline:allDay ?allday . } \n"+
            "  OPTIONAL { ?e dc:title ?title . } \n"+
            "  OPTIONAL { ?e ui:color ?color . } \n"+
            "  OPTIONAL { ?e foaf:maker ?maker . } \n"+
            "}";

        var eq = $rdf.SPARQLToQuery(query,false,g)
        var onresult = function(r) {
            var event = {
                id: r['?e']['value'],
                start: (r['?start'])?$.fullCalendar.parseISO8601(r['?start']['value']):undefined,
                end: (r['?end'])?$.fullCalendar.parseISO8601(r['?end']['value']):undefined,
                allDay: (r['?allday'])?true:false,
                title: (r['?title'])?r['?title']['value']:undefined,
                color: (r['?color'])?r['?color']['value']:undefined,
                maker: (r['?maker'])?r['?maker']['value']:undefined
            };
            console.log(event);
            calEvents.push(event);
        }
        
        g.query(eq,onresult,undefined,undefined);
   */
        render(calEvents);
    });
}

function putRemote(uri, data) {
    $.ajax({
        type: "PUT",
        url: uri,
        contentType: "text/turtle",
        data: data,
        processData: false,
        statusCode: {
            200: function() {
                console.log("200 Success");
            },
            401: function() {
                console.log("401 Unauthorized");
            },
            403: function() {
                console.log("403 Forbidden");
            },
            406: function() {
                console.log("406 Contet-type unacceptable");
            },
            507: function() {
                console.log("507 Insufficient storage");
            },
        },
        complete: function() {
            $('#spinner').hide();
        }
    });
}

// Save calendar data to user storage
function saveEvent (path) {
    $('#editevent').hide(); 
    $('#spinner').show();
    // date picker
    var $pickerStart = $('#pickerStart').pickadate();
    var ps = $pickerStart.pickadate('picker').get('highlight');
    var $pickerEnd = $('#pickerEnd').pickadate();
    var pe = $pickerEnd.pickadate('picker').get('highlight');
    // DEBUG
    /*
    console.log(mywebid);
    console.log('id='+$('#id').val());
    console.log('allDay='+$('#allDay').prop('checked'));
    console.log('startDay='+ps.pick);
    console.log('endDay='+pe.pick);
    console.log('startHour='+$('#startHour').val());
    console.log('endHour='+$('#endHour').val());
    console.log('title='+$('#title').val());
    console.log('color='+$('#checkedImg').attr('alt'));
    */
    // end DEBUG
    var id = $('#id').val();
    var title = $('#title').val();    
    var color = $('#checkedImg').attr('alt');
    var allDay = $('#allDay').prop('checked');

    var startHour = (parseInt($('#startHour').val().slice(0,2)) * 3600000)+
                        parseInt($('#startHour').val().slice(-2));
    var endHour   = (parseInt($('#endHour').val().slice(0,2)) * 3600000)+
                        parseInt($('#endHour').val().slice(-2));
    var startDay = parseInt(ps.pick) + parseInt(startHour);
    startDay = new Date(parseInt(startDay));

    var endDay = parseInt(pe.pick);
    if (endDay) {
        endDay = new Date(endDay + endHour);
    }

    // prepare the ID
    var exists = false;
    if (id) {
        exists = true;
    } else {
        var blob = title+color+allDay+startHour+endHour+startDay+endDay;
        id = '#'+hex_sha1(blob);
    }
    
    var event = {
            id: id,
            start: (startDay)?startDay:undefined,
            end: (endDay)?endDay:undefined,
            allDay: allDay,
            title: (title)?title:undefined,
            color: (color)?color:undefined,
            maker: (mywebid)?mywebid:undefined
        };

    // save event locally
    if (exists) {
        for (var i in calEvents) {
            // update by removing the existing event
            if (calEvents[i].id == id)
                calEvents.splice(i, 1);
        }
    }
    // add event to array
    calEvents.push(event);
    // transform to RDF so we can save remotely
    var data = eventsToRDF();

    // prepare the resource URI
    if (!path)
        path = getCalPath(startDay, undefined, 'events'); 
    // finally write the data remotely
    putRemote(path, data);

    // redraw the calendar
    var view = $('#calendar').fullCalendar('getView');
    $('#calendar').fullCalendar('destroy');
    render(calEvents);
    $('#calendar').fullCalendar('changeView', view.name);
}

function eventsToRDF() {
    var RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    var EVENTS  = $rdf.Namespace('http://purl.org/NET/c4dm/event.owl#');
    var TIME = $rdf.Namespace('http://purl.org/NET/c4dm/timeline.owl#');
    var DC = $rdf.Namespace('http://purl.org/dc/elements/1.1/');
    var FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
    var UI = $rdf.Namespace('http://www.w3.org/ns/ui#');
    // save the data in a graph
    g = $rdf.graph();

    for (var i in calEvents) {
        var event = calEvents[i];     
        
        // set triples
        g.add($rdf.sym(event['id']),
                RDF('type'),
                EVENTS('Event'));
        g.add($rdf.sym(event['id']),
                TIME('start'),
                $rdf.lit(event['start'].toISOString(), '', $rdf.Symbol.prototype.XSDdateTime));
        if (event['end']) {
            g.add($rdf.sym(event['id']),
                    TIME('end'),
                    $rdf.lit(event['end'].toISOString(), '', $rdf.Symbol.prototype.XSDdateTime));
        }
        if (event['allDay']) {
            g.add($rdf.sym(event['id']),
                TIME('allDay'),
                $rdf.lit(event['allDay']));
        }
        g.add($rdf.sym(event['id']),
                DC('title'),
                $rdf.lit(event['title']));
        g.add($rdf.sym(event['id']),
                UI('color'),
                $rdf.lit(event['color']));
        g.add($rdf.sym(event['id']),
                FOAF('maker'),
                $rdf.sym(event['maker']));
    }
    return new $rdf.Serializer(g).toN3(g);
}


function eventToRDF(id, title, color, allDay, startDay, endDay) {
    var RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    var EVENTS  = $rdf.Namespace('http://purl.org/NET/c4dm/event.owl#');
    var TIME = $rdf.Namespace('http://purl.org/NET/c4dm/timeline.owl#');
    var DC = $rdf.Namespace('http://purl.org/dc/elements/1.1/');
    var FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
    var UI = $rdf.Namespace('http://www.w3.org/ns/ui#');
    // save the data in a graph
    g = $rdf.graph();

    // set triples
    g.add($rdf.sym(id),
            RDF('type'),
            EVENTS('Event'));
    g.add($rdf.sym(id),
            TIME('start'),
            $rdf.lit(startDay.toISOString(), '', $rdf.Symbol.prototype.XSDdateTime));
    if (endDay) {
        g.add($rdf.sym(id),
                TIME('end'),
                $rdf.lit(endDay.toISOString(), '', $rdf.Symbol.prototype.XSDdateTime));
    }
    if (allDay) {
        g.add($rdf.sym(id),
            TIME('allDay'),
            $rdf.lit(allDay));
    }
    g.add($rdf.sym(id),
            DC('title'),
            $rdf.lit(title));
    g.add($rdf.sym(id),
            UI('color'),
            $rdf.lit(color));
    g.add($rdf.sym(id),
            FOAF('maker'),
            $rdf.sym(mywebid));
    var data = new $rdf.Serializer(g).toN3(g);

    return data;
}

function updateEvent(event) {
    $('#spinner').show();
    // transform to RDF so we can save remotely
    var data = eventsToRDF();

    // prepare the resource URI
    if (!path)
        var path = getCalPath(event.start, undefined, 'events'); 
    // finally write the data remotely
    putRemote(path, data);

    // redraw the calendar
    var view = $('#calendar').fullCalendar('getView');
    $('#calendar').fullCalendar('destroy');
    render(calEvents);
    $('#calendar').fullCalendar('changeView', view.name);
    $('#spinner').hide();
}

function deleteEvent() {
    var id = $('#id').val();
    
    // hide UI
    $('#editevent').hide()

    // remove event from display
    $('#calendar').fullCalendar('removeEvents', [id]);
    // remove event from events
    for (var event in calEvents) {
        if (calEvents[event].id == id)
            calEvents.splice(event, 1);
    }
    // update remotely
        // transform to RDF so we can save remotely
    var data = eventsToRDF();

    // prepare the resource URI
    if (!path)
        var path = getCalPath(startDay, undefined, 'events'); 
    // finally write the data remotely
    putRemote(path, data);

    // redraw the calendar
    $('#calendar').empty();
    render(calEvents);
    
    return;
}

// ----- RENDER -------
function render(events) {
    $('#spinner').show();
	var calendar = $('#calendar').fullCalendar({
		header: {
			left: 'prev,next today',
			center: 'title',
			right: 'month,agendaWeek,agendaDay'
		},
		selectable: true,
		selectHelper: true,
        eventClick: function(calEvent, jsEvent, view) {
            clearFields();
            $('#id').val(calEvent.id);
            
            var startDay = $.fullCalendar.formatDate(calEvent.start, 'ddd, MMMM dd yyyy');
            var endDay = (!calEvent.end)?$.fullCalendar.formatDate(calEvent.start, 'ddd, MMMM dd yyyy'):$.fullCalendar.formatDate(calEvent.end, 'ddd, MMMM dd yyyy');    
            
            // date picker
            var $pickerStart = $('#pickerStart').pickadate();
            var ps = $pickerStart.pickadate('picker').set('select', $.fullCalendar.parseDate(startDay));
            var $pickerEnd = $('#pickerEnd').pickadate();
            var pe = $pickerEnd.pickadate('picker').set('select', $.fullCalendar.parseDate(endDay));

            $('#title').val(calEvent.title);
            setColor(calEvent.color);
            // time
            var startHour = $.fullCalendar.formatDate(calEvent.start, 'HH:mm');
            // set 1h interval by default if no end hour is set
            if (calEvent.allDay == false && !calEvent.end) {
                var endHour = parseInt(startHour.slice(0, startHour.indexOf(':')))+1;
                var endHour = endHour+':00';
            } else if (calEvent.end) {
                var endHour = $.fullCalendar.formatDate(calEvent.end, 'HH:mm');
            } else {
                var endHour = '00:00';
            }

            $('#timepicker').html('');
            $('#timepicker').append('<span class="span-left cell inline-block">Event time</span>'+
                            '<div class="left cell inline-block">'+timeSelector('startHour', startHour)+'</div>');
            $('#timepicker').append('<div class="left cell inline-block">'+timeSelector('endHour', endHour)+'</div>');

            if (calEvent.allDay == true) {
                $('#allDay').prop('checked', true);
                $('#startHour').prop('disabled', true);
                $('#endHour').prop('disabled', true);
            }

            // show editor
            showEditor(jsEvent);
            $('#title').focus();
		},
		select: function(start, end, allDay, jsEvent) {
		    clearFields();
            setColor();
            startDay = $.fullCalendar.formatDate(start, 'ddd, MMMM dd yyyy');
            endDay = $.fullCalendar.formatDate(end, 'ddd, MMMM dd yyyy');

            // date picker
            var $pickerStart = $('#pickerStart').pickadate();
            var ps = $pickerStart.pickadate('picker').set('select', $.fullCalendar.parseDate(start));
            var $pickerEnd = $('#pickerEnd').pickadate();
            var pe = $pickerEnd.pickadate('picker').set('select', $.fullCalendar.parseDate(end));

            // time
            var startHour = $.fullCalendar.formatDate(start, 'HH:mm');
            if (allDay == true || !end) {
                var hour = parseInt(startHour.slice(0, startHour.indexOf(':')))+1;
                var mins = parseInt(startHour.slice(startHour.indexOf(':'), startHour.length));
                endHour = hour+':'+mins;
            } else {
                var endHour = $.fullCalendar.formatDate(end, 'HH:mm');
            }
                        
            $('#timepicker').html('');
            $('#timepicker').append('<span class="span-left cell inline-block">Event time</span>'+
                            '<div class="left cell inline-block">'+timeSelector('startHour', startHour)+'</div>');
            $('#timepicker').append('<div class="left cell inline-block">'+timeSelector('endHour', endHour)+'</div>');

            if (allDay == true) {
                $('#allDay').prop('checked', true);
                $('#startHour').prop('disabled', true);
                $('#endHour').prop('disabled', true);
            }

            showEditor(jsEvent);
            $('#title').focus();
		},
		eventDrop: function(event,dayDelta,minuteDelta,allDay,revertFunc) {
		    // update after dragging an event
            if (!confirm("Are you sure about this change?")) {
                revertFunc();
            } else {
                updateEvent(event);
            }
        },
        eventResize: function(event,dayDelta,minuteDelta,revertFunc) {
            // update after resizing an event (in week/day view)
            if (!confirm("Are you sure about this change?")) {
                revertFunc();
            } else {
                updateEvent(event);
            }

        },
		editable: true,
        events: events
	});
	$('#spinner').hide();
}

// Display the editor dialog
function showEditor(e) {
    // don't overflow
    e = window.event || e;
    var bottomOfViewport = $(window).scrollTop() + $(window).height();
    var bottomOfBox = e.pageY + $('#editevent').height();
    if ( bottomOfViewport <= bottomOfBox )
        var topVal = bottomOfViewport - 50 - $('#editevent').height();    
    else
        var topVal = e.clientY-50;
    var leftVal = e.clientX-200;
    // set the coords
    $('#editevent').css({
        top: topVal+'px',
        left: leftVal+'px'
    });
    $('#editevent').show();
}

// close editor
$(document).bind('keydown', function(e) {
    if (e.keyCode == 27) { // ESC
        $('#editevent').hide();
    }
});

function timeSelector (id, defValue) {
    if (!defValue || defValue == '')
        defValue = '10:00';
    var html = '<select id="'+id+'" class="'+id+'" name="'+id+'"';
    html += (id == 'startHour')?' onchange="updateHour()">':'>';
    for(i = 0; i <= 23; i++) {
        if (i<10)
            i='0'+i;
        for (j=0; j<2; j++) {
            var m = (j == 0)?'00':'30';
            var txt = i+':'+m;
            var selected = (txt == defValue)?' selected="selected"' : '';
            html += '<option value="'+txt+'" '+selected+'>'+txt+'</option>';
        }
    }
    html += "</select>";

    return html;
}

// enable hour selector
function toggleHours () {
    if ($('#allDay').prop('checked') == false) {
        $('#startHour').prop('disabled', false);
        $('#endHour').prop('disabled', false);
    } else {
        $('#startHour').prop('disabled', true);
        $('#endHour').prop('disabled', true);
    }
}

function setColor (color) {
    var defClass;
    if (!color)
        color = '#5484ed'; // default
    switch (color) {
        case '#5484ed': defClass = 'Blue'; break;
        case '#e52127': defClass = 'Red'; break;
        case '#51b749': defClass = 'Green'; break;
        case '#fbd75b': defClass = 'Yellow'; break;
        case '#dbadff': defClass = 'Purple'; break;
        default: defClass = 'Blue';
    }
    $('#checkedImg').remove();
    var htmlChecked = '<img id="checkedImg" class="checkedImg" src="img/checked.png" title="'+defClass+'" alt="'+color+'" />';
    $('#'+defClass).html(htmlChecked);
}

// update end hour selector based on start hour value
function updateHour(){
    var startHour = $('#startHour').val();
    var hour = parseInt(startHour.slice(0, startHour.indexOf(':')))+1;
    hour = (hour.toString().length < 2)?'0'+hour:hour.toString();
    var mins = startHour.slice(startHour.indexOf(':'), startHour.length);
    hour = hour+mins;
	$('#endHour').val(hour);
}

// ----- USER INFO -------
function userInfo (webid, baseId) {
    var RDF = $rdf.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    var FOAF = $rdf.Namespace("http://xmlns.com/foaf/0.1/");
    var WAPP = $rdf.Namespace("http://my-profile.eu/ns/webapp#");
    var g = $rdf.graph();
    var f = $rdf.fetcher(g);
    // add CORS proxy
    $rdf.Fetcher.crossSiteProxyTemplate=proxy_template;
    
    var docURI = webid.slice(0, webid.indexOf('#'));
    var webidRes = $rdf.sym(webid);
    
    // fetch user data
    f.nowOrWhenFetched(docURI,undefined,function(){
        // export the user graph
        mygraph = g;
        // get some basic info
        var name = g.any(webidRes, FOAF('name'));
        var pic = g.any(webidRes, FOAF('img'));
        var depic = g.any(webidRes, FOAF('depiction'));
       
        if (name == undefined)
            name = 'Unknown';
        else
            name = name.value;

        if (name.length > 22)
            name = name.slice(0, 18)+'...';

        if (pic == undefined) {
            if (depic)
                pic = depic.value;
            else
                pic = 'https://rww.io/common/images/nouser.png';
        } else {
            pic = pic.value;
        }
        
        // main divs      
        var html = $('<div class="user left">Welcome, <strong>'+name+'</strong></div><div class="user-pic right"><img src="'+pic+'" title="'+name+'" class="login-photo img-border" /></div>');
        $('#'+baseId).append(html);
    });
}
