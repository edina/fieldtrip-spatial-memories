/*
Copyright (c) 2014, EDINA.
All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this
   list of conditions and the following disclaimer in the documentation and/or
   other materials provided with the distribution.
3. All advertising materials mentioning features or use of this software must
   display the following acknowledgement: This product includes software
   developed by the EDINA.
4. Neither the name of the EDINA nor the names of its contributors may be used to
   endorse or promote products derived from this software without specific prior
   written permission.

THIS SOFTWARE IS PROVIDED BY EDINA ''AS IS'' AND ANY EXPRESS OR IMPLIED
WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
SHALL EDINA BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
DAMAGE.
*/

"use strict";

var geofencing;

define(['records', 'utils', 'map', 'ui', '../../gps-tracking/js/tracks', 'underscore', 'text!templates/saved-records-list-template.html' ],
        function(records, utils, map, ui, tracks, _, recrowtemplate){


    $(document).on('pageshow', '#saved-tracks-records-page', function(){

        $('.ui-block-c.ui-header-buttons.ui-btn-right').remove();

        var annotations = records.getSavedRecords();

        var addAnnotation = function(id, annotation){
            var template = _.template(recrowtemplate);

            $('#saved-records-list-list').append(
                template({
                    "id": id,
                    "annotation": annotation,
                    "fields": annotation.record.fields,
                    "records": records
                })
            ).trigger('create');
        }

        
        function addAnnotationsToList(annotations) {
              $.each(annotations , $.proxy(function(id, annotation){
                if(annotation){
                    addAnnotation(id, annotation);
                }
                else{
                    // empty entry, just delete it
                    delete annotations[id];
                    this.records.setSavedAnnotations(annotations);
                }

            }, this));
        }


        /**
         * toggleDisplay
         * takes an id (either records-tracks or records-annotations),
         * adds to local storage and toggles tracks/records button and
         * track list or annotation grid layout style
         */
        function toggleDisplay(id) {
            // store preference so it persists
            localStorage.setItem('records-layout', id);

            // Get the button and ensure it's active
            var button  = $('#' + id);
            button.toggleClass('ui-btn-active', true);

            // Remove active class from any other buttons
            $.each(button.siblings('a'), function (key, value) {
                $(value).toggleClass('ui-btn-active', false);
            });

            var isAnnotations = id === 'records-annotations';
           
             
            // Clear default view
            $('#saved-records-list-list').empty();
                
            // Need to delete/add tracks/annotations as appropriate
            if(isAnnotations){
                var trackId = sessionStorage.getItem('trackId');
                // finished with this so remove now
                sessionStorage.removeItem('trackId');
                var annotationsToDisplay;
                if(trackId != null){
                    annotationsToDisplay = records.getSavedRecordsForTrack(trackId);
                }else{
                    annotationsToDisplay = records.getSavedRecordsExcludingTracks();
                }
                addAnnotationsToList(annotationsToDisplay);
               
             
            }else{
                var tracks = records.getSavedTracks();
                addAnnotationsToList(tracks);
            }
            $('#saved-tracks-records-page .ui-listview li').toggleClass('active', isAnnotations);
            $('.record-extra').toggle(isAnnotations);
            $('p.ellipsis').removeClass('ellipsis');

            $('#saved-annotations-list-list').listview('refresh');
            
        };

        // Toggle Annotations/Tracks Layout on button click
        $('#layout-toggle a').on('click', function (e) {
            toggleDisplay($(e.currentTarget).attr('id'));
        });

        // Annotations loaded at this point so we can setup layout
        // Check if preference previously set in local storage
        toggleDisplay(localStorage.getItem('records-layout'));

        // delete a saved record
        $(document).off('click', '.saved-records-delete');
        $(document).on(
            'click',
            '.saved-records-delete',
            $.proxy(function(event){
                this.toBeDeleted = $(event.target).parents('li');

                // open dialog for confirmation
                $('#saved-records-delete-popup-name').text(
                    "'" + this.toBeDeleted.find('.saved-record-view a').text() + "'");
                $('#saved-records-delete-popup').popup('open');
            }, this)
        );

        // delete confirm
        $('#saved-record-delete-confirm').click($.proxy(function(event){
            var id = $(this.toBeDeleted).attr('id');
            records.deleteAnnotation(id, true);
            map.refreshRecords();
            $('#saved-records-delete-popup').popup('close');
            this.toBeDeleted.slideUp('slow');
        }, this));

     

        // click on a record
        $(document).off('click', '.saved-records-view');
        $(document).on(
            'click',
            '.saved-records-view',
            function(event){
                if(this.isMobileApp){
                    // this will prevent the event propagating to next screen
                    event.stopImmediatePropagation();
                }

                var id = $(event.target).parents('li').attr('id');
                var annotation = records.getSavedRecord(id);
                var isTrack = records.isTrack(annotation);
                
                if(isTrack){
                    console.log('Track has been clicked - got to annotation list screen for now');
                    // Add to session storage
                    sessionStorage.setItem('trackId', id);

                    toggleDisplay('records-annotations');
                    // map.showRecordsLayer(annotation);
                    // utils.gotoMapPage()
                    
                }else{
                    // Go to map page
                    map.showRecordsLayer(annotation);
                    utils.gotoMapPage();
                }
            }
        );
      
    });

    /**
     * hack alert - remove sync buttons that interfere with list/grid view
     */
    $(document).on('pageinit', '#saved-records-page', function(){
        $('.ui-block-c.ui-header-buttons.ui-btn-right').remove();
    });
    /**
     * newTextCreated
     * Listen for when a text annotation has been saved.
     * We can then resave the same record with the current
     * track id.
     */
    $(document).on("newTextCreated", function (evt) {
        var annotationId = evt.id;
        var annotation = records.getSavedRecord(annotationId);
        var trackId = 'defaultTrackId';
        if (tracks.currentTrack !== undefined) {
            trackId = tracks.currentTrack.id;
        }
        
        
        
        annotation['trackId'] = trackId;
        // resave annotation with trackId
        map.pointToExternal(annotation.record.point);
        geofenceRecord(annotationId, annotation.record.point);
        records.saveAnnotation(annotationId, annotation);
    });


    var GEOFENCE_RADIUS_METERS = 20;
    var params = { callback: 'onGeofenceEvent', notifyMessage: '%2$s your home!' };
    var other = this;

    // For Spatial Memories, centre on Macrobert Arts Centre
    map.overrideDefaultLonLat(-3.919802, 56.145737);

    if(typeof(geofencing) !== 'undefined'){
        geofencing.register(params);
    } else {
        //create a null object to work on desktop
       geofencing = { addRegion: function(){} };
    
    }



    var geofenceRecord =  function(geofenceId, point){


        var gfparams = {"fid": geofenceId, "radius": GEOFENCE_RADIUS_METERS, "latitude": point.lat , "longitude": point.lon };
        if(typeof(geofencing) !== 'undefined'){

            geofencing.addRegion(
                            function() {
                            console.debug("region added");
                            },
                            function(e) {
                            console.debug("error occurred adding geofence region") ;
                            }, gfparams);
          }

        };



    $.each(records.getSavedRecords(), function(id, annotation){
        var record = annotation.record;
        if(record.editor !== 'track.edtr'){
            map.pointToExternal(record.point);
            geofenceRecord(record.geofenceId, record.point);
        }
    });

    // map switching
    $(document).on('change', '#settings-mapserver-url', function(){
        if(utils.isMobileDevice()){
            var url = "http://a.tiles.mapbox.com/v3/" +
                $('#settings-mapserver-url option:selected').val() +
                "/${z}/${x}/${y}.png";
            var baseLayer = new OpenLayers.Layer.XYZ(
                "Map Box Layer",
                [url], {
                    sphericalMercator: true,
                    wrapDateLine: true,
                    numZoomLevels: 20
                }
            );

            map.switchBaseLayer(baseLayer);
        }
        else{
            utils.inform("Switching doesn't work on the desktop.");
        }
    });

    // gps tracking
    $(document).on('pageinit', '#gpscapture-page', function(){


    map.addRecordClickListener(function(feature){

     if(feature.attributes.type === 'track'){

        // TODO check trackId in session storage to see if track already open

        var recordsLayer = map.getRecordsLayer() ;
        map.removeAllFeatures(recordsLayer) ;
        tracks.hideAllTracks() ;
        map.showTrackRecords() ;
        map.showRecordsForTrack(feature.attributes.id) ;
        tracks.displayTrack(feature.attributes.id) ;
        sessionStorage.setItem('trackId', feature.attributes.id);
     }
    });


        var setupButtons = function(running){
            if(running){
                $('#gpscapture-stop-button').removeClass('ui-disabled');
                $('#gpscapture-play').addClass('ui-disabled');
            }
            else{
                $('#gpscapture-stop-button').addClass('ui-disabled');
                $('#gpscapture-play').removeClass('ui-disabled');
                $('#gpscapture-confirm-popup').popup('close');
            }

            // disable audio on android
            if(!utils.isIOSApp()){
                $('.audio-button').addClass('ui-disabled');
            }

            // Disable ability to add annotations if no track is started
            if (tracks.currentTrack === undefined) {
                $('.audio-button').addClass('ui-disabled');
                $('.photo-button').addClass('ui-disabled');
                $('.text-button').addClass('ui-disabled');
            }
        };

        var createAnnotation = function(type, val){
            var trackId = 'defaultTrackId';
            // Get the track id and add to annotation
            if (tracks.currentTrack !== undefined) {
               trackId = tracks.currentTrack.id;
            }
            var annotation = {
                "record": {
                    'editor': type + '.edtr',
                    'fields': [],
                    'name': type + utils.getSimpleDate()
                },
                "isSynced": false,
                "trackId": trackId
            }

            if(type === 'image' || type === 'audio'){
                annotation.record.fields.push({
                    "id": "fieldcontain-" + type + "-1",
                    "val": val,
                    "label": utils.capitaliseFirstLetter(type)
                });
            }

            // get device location and convert it to mercator
            map.getLocation(function(position){

                var latitude = position.coords.latitude;
                var longitude = position.coords.longitude;
                map.pointToInternal(position.coords);

                // save record and refresh map
                var geofenceId = records.saveAnnotationWithCoords(
                    annotation,
                    position.coords
                );
                

                geofenceRecord( geofenceId, {"lat": latitude,  "lon":longitude});
  

                map.refreshRecords(annotation);
                $.mobile.changePage('gps-capture.html');
            });
        };
        
  

        // save track
        $('#gpscapture-confirm-save').click(function(){
            $('#gpscapture-confirm-popup').popup('close');
            setupButtons(false);
        });

        // start track
        $('#gpscapture-play').click(function(e){
            $.mobile.changePage('annotate-gps.html');
        });

        // discard track
        $('#gpscapture-confirm-discard').click(function(){
            setupButtons(false);
        });

        $('.photo-button').click(function(e){

            // Use the custom camera plugin
            navigator.CustomCamera.getPicture(function(imagePath){
                createAnnotation('image', imagePath);
            }, function(){
                alert("Photo cancelled");
            });
        });
        $('.audio-button').click(function(e){
            records.takeAudio(function(media){
                createAnnotation('audio', media);
            });

        });
        $('.text-button').click(function(e){
            records.annotateText();
        });

        setupButtons(tracks.gpsTrackRunning());
    });
    



}); // ends define scope



//in global scope callback from cordova
function onGeofenceEvent(event) {
    require(['records'], function (records){

        var showAnnotation = function (annotation) {

        $('#map-record-popup').off('popupbeforeposition');
        $('#map-record-popup').on({
                                  popupbeforeposition: function() {
                                  var showRecord = function(html){
                                    $('#map-record-popup-text').append(html).trigger('create');
                                  };

                                  $('#map-record-popup h3').text(annotation.record.name);
                                  $('#map-record-popup-text').text('');

                                  $.each(annotation.record.fields, function(i, entry){
                                         var html;
                                         var type = records.typeFromId(entry.id);

                                         if(type === 'image'){
                                         html = '<img src="' + entry.val + '" width=100%"/>';
                                         showRecord(html);
                                         }
                                         else if(type === 'audio'){
                                         require(['audio'], function(audio){
                                                 html = audio.getNode(entry.val, entry.label + ':');
                                                 showRecord(html);
                                                 });
                                         }
                                         else if(entry.id !== 'text0'){ // ignore title element
                                         html = '<p><span>' + entry.label + '</span>: ' +
                                         entry.val + '</p>';
                                         showRecord(html);
                                         }
                                         });
                                  }
                                  });

        $('#map-record-popup').popup('open');
        // Close popup on click
        $('#map-record-popup').on('click',  function() {
            $('#map-record-popup').popup('close');
        });

        };

        /**
         * checkPopups
         * If an annotation has been stored in sessionStorage
         * with key annotationPopup, the appropriate popup
         * will be shown automatically
         */
        var checkPopups = function() {
            var a = sessionStorage.getItem('annotationPopup');
            if (a !== 'undefined') {
                var annotation = $.parseJSON(a);
                if (annotation) {
                    map.createPopup(annotation);
                    $('#map-record-popup').popup('open');
                }
                // Clean up
                sessionStorage.removeItem('annotationPopup');
            }
        };
        $(document).on('pageshow', '#gpscapture-page', checkPopups);

        var lookupRecord = function() {
            $.each(records.getSavedRecords(), function(id, annotation){
                var record = annotation.record;
                if(record.geofenceId === event.fid) {
                   showAnnotation(annotation);
                }
            });

        };

        if(event.status.substring(0, 'entered'.length) === 'entered'){
            lookupRecord();
        }
    });
    console.debug('region event id: ' + event.fid + ' got event with status: ' + event.status) ;
    //alert('region event id: ' + event.fid + ' got event with status: ' + event.status) ;
}


