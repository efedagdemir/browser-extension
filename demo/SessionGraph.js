var cy = null;          // The variable that holds the cytoscape object.
var interval = null;    // A setInterval() result that updates the session graph every 30 seconds.
let container = document.createElement("div");
let willowNodeClicked = false;

/**
 * Initalizes the session graph as a cytoscape object with no elements.
 */
async function initializeSG() {
    // create an HTML container for the graph in the background page
    //* This page is not rendered, the container's sole purpose is to enable cytospace.js to work properly.
    // ! This is problematic!
   // container.style.width = container.style.height = "700px"; // random values for width and height.
    document.body.appendChild(container);
    container.id ="container";

    let nextId;
    await new Promise((resolve, reject) => {chrome.storage.local.get("nextId", function (result) {
        nextId = result.nextId;
        chrome.storage.local.set({nextId: nextId + 1});
        resolve();
    })});

    cy = cytoscape({
        container: container,
        style: [ // the stylesheet for the graph
            {
                selector: 'node',
                style: {
                    'label': 'data(title)',
                    'border-color':'data(border_color)',
                    'font-size': 'data(title_size)',
                    'width': 'data(width)',
                    'height': 'data(width)',
                    'text-wrap': 'wrap',
                    'text-max-width': '170px',
                    'text-justification': 'center'
                }
            },
        ],
        ready: function () {
            // ready 1
        }
    });
    cy.data("id", nextId);
    applyStyle();
    cytoscape.warnings(false);

    //Adding highlight style

    // start saving the session graph every 30 seconds.
    interval = setInterval( saveCurrentSession, 30000);
}

/**
 * Loads the given graph into session graph.
 * @param {Object} cyJson Cytoscape JSON export.
 */
function loadSG(cyJson) {
    cy.json(cyJson);
}

/**
 * Clears the session graph.
 */
async function clearSG(){
    await saveCurrentSession();
    clearInterval(interval);
    initialize();

    // create a blank tab and activate it
    await new Promise ( (resolve, reject) => { chrome.tabs.create({url: "chrome://newtab", active: true}, ()=> resolve())});

    // close all tabs but the active one.
    chrome.tabs.query( {active:false, currentWindow: true},  (tabs) => {
        for( let tab of tabs) {
            if(!tab.url.startsWith("chrome")) {
                chrome.tabs.remove(tab.id);
            }
        }
    });

    chrome.tabs.query( {currentWindow: false},  (tabs) => {
        for( let tab of tabs) {
            if(!tab.url.startsWith("chrome")) {
                chrome.tabs.remove(tab.id);
            }
        }
    });

    broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST", notifyActiveTab: true});
}

function getCytoscapeJSON(){
    return cy.json(true);
}

function updateNodePosition(nodeId, newPos) {
    cy.getElementById(nodeId).position(newPos);
    //addFixedNodes(nodeId, newPos, 0);
  //  alert("dragging");
    broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST"});
    //alert("done dragging");
   // alert("updateNodePosition " + cy.width());
}

function removeNode(nodeId) {
    ////console.log("DELETING NODE");
    let node = cy.getElementById(nodeId);
    cy.remove(node);

    // remove the entry from tabUrls
    if (node.data("openTabCount") > 0 ) {
        let nodeUrl = node.data("id");
        tabURLs.forEach((url, tabId) => {
            if(nodeUrl == url)
                tabURLs.delete(tabId);
        });
    }
    broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST"});
    return true;
}

function openPage(nodeId) {
    //! This results in an edge because the transition type of the visit caused by this function is "link".
    openingFromGraph.set(nodeId, true);
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var tab = tabs[0];
        chrome.tabs.update(tab.id, {url: nodeId}, function() {
            // sync after callback
            //broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST", notifyActiveTab: true});
        });
    });
    return true;
}
function openPageInNewTab(nodeId) {
    willowNodeClicked = true;
    chrome.tabs.create({url: nodeId}, function () {
         //sync after callback
    });
    return true;
}


function removeEdge(source, target) {
    //! Bu henüz olmuyo.

    //TODO commented kisimlar = basarisiz denemeler
    /*let edge= cy.edges('edge[source = "' + source + '"][target = "' + target + '"]');
    cy.remove(edge);*/
    return true;
}

function changeBorderColor(nodeId, color) {
    //determine the hex value of the selected color
    if (color == "red")
        hexColorValue = '#d50000';
    else if (color == "green")
        hexColorValue = '#49a84d';
    else if (color == "blue")
        hexColorValue = '#0388e7';
    else if (color == 'pink')
        hexColorValue = '#ed539e';
    else if (color == 'yellow')
        hexColorValue = '#f6b126';
    else if (color == 'purple')
        hexColorValue = '#9424aa';
    else if (color == 'black')
        hexColorValue = '#000000'
        
    let node = cy.getElementById(nodeId); 
    node.data("border_color", hexColorValue);

    broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST"});
}

function changeNodeSize(nodeId, size, tSize) {
    let node = cy.getElementById(nodeId); 
    node.data("width", size);
    node.data("title_size", tSize);
    broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST", action: "CHANGE_NODE_SIZE"});
}

var UNIFORM_DEFAULT_SIZE = 35;
var UNIFORM_TITLE_SIZE = '20px';
var PAGERANK_AVG_SIZE = 55;
var PAGERANK_AVG_TITLE_SIZE = '22px';
function resetNodeSizes(option) {
    if (option === "uniform") {
        cy.nodes().forEach(function( ele ){
            ele.data("width", UNIFORM_DEFAULT_SIZE);
            ele.data('title_size', UNIFORM_TITLE_SIZE);
        });
        broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST",notifyActiveTab:true});
    } else if (option === "pagerank") {
        var pr = cy.elements().pageRank();
        cy.nodes().forEach(function( ele ){
            ele.data("width", pr.rank(ele) * PAGERANK_AVG_SIZE * cy.nodes().size());
            ele.data('tite_size', PAGERANK_AVG_TITLE_SIZE);
        });
        broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST", notifyActiveTab:true});
    } else {
        //console.error("resetNodeSizes called with invalid option");
        return;
    }
}

function exportJSON() {
    ////console.log("exporting JSON");
    var blob = new Blob([JSON.stringify(cy.json())], {type: 'application/willow'})
    var url = URL.createObjectURL(blob);

    var now = new Date();
    var name = "Willow Session " + now.getFullYear()+'-'+String((now.getMonth()+1)).padStart(2,'0')+'-'+ String(now.getDate()).padStart(2,'0') + ' at '
                + now.getHours() + "." + String(now.getMinutes()).padStart(2,'0') + "." + String(now.getSeconds()).padStart(2,'0');
    ////console.log(name);
    chrome.downloads.download({
      url: url, // The object URL can be used as download URL
      filename: name + ".willow",
      saveAs: true,
    });
}

async function importJSON(json) {
    //console.log("importing JSON");
    cy.json(json);
    let nodes = cy.nodes();

    // create a blank tab and activate it
    await new Promise ( (resolve, reject) => { chrome.tabs.create({url: "chrome://newtab", active: true}, ()=> resolve())});

    // close all tabs but the active one.
    chrome.tabs.query( {active:false, currentWindow: true},  (tabs) => {
        for( let tab of tabs) {
            if(!tab.url.startsWith("chrome")) {
                chrome.tabs.remove(tab.id);
            }
        }
    });

    chrome.tabs.query( {currentWindow: false},  (tabs) => {
        for( let tab of tabs) {
            if(!tab.url.startsWith("chrome")) {
                chrome.tabs.remove(tab.id);
            }
        }
    });

    chrome.tabs.query( {active:true, currentWindow: true}, (tabs) => { chrome.tabs.update(tabs[0].id, {url : "chrome://newtab"})});

    let promises = []
    // create the tabs that were open in the imported JSON
    nodes.forEach( (node) => {
        if(node.data("openTabCount") > 0) {
            let tabCount = node.data("openTabCount");
            node.data("openTabCount", 0);
            for( let i = 0; i < tabCount; i ++) {
                openingFromGraph.set(node.id(), true);
                let promise = new Promise ( (resolve, reject) => {
                    chrome.tabs.create({url: node.id(), active: false}, function(result) {
                        resolve(true);
                    });
                });
                promises.push(promise);
            }
        }
    });
    
    await Promise.all(promises);
    
    chrome.tabs.query( {active:true, currentWindow: true}, (tabs) => { chrome.tabs.remove(tabs[0].id)});

    broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST_WINDOW_PANEL", notifyActiveTab: true});
}

function addComment(nodeId,comment){
    let node = cy.getElementById(nodeId);
    node.data("comment", comment);
    broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST"});
}

function messageReceived(request, sender, sendResponse) {
    if (request.type ==="getCytoscapeJSON") {
        sendResponse(this.getCytoscapeJSON());
    } else if (request.message === "WILLOW_BACKGROUND_UPDATE_NODE_POS") {
        updateNodePosition(request.nodeId, request.newPos);
    } else if (request.message === "WILLOW_BACKGROUND_REMOVE_NODE") {
        removeNode(request.nodeId);
    } else if (request.message === "WILLOW_BACKGROUND_OPEN_PAGE") {
        openPage(request.nodeId);
    } else if (request.message === "WILLOW_BACKGROUND_OPEN_PAGE_IN_NEW_TAB") {
        openPageInNewTab(request.nodeId);
    } else if (request.message === "WILLOW_BACKGROUND_REMOVE_EDGE") {
        removeEdge(request.source, request.target);
    } else if (request.message === "WILLOW_BACKGROUND_CHANGE_BORDER_COLOR") {
        changeBorderColor(request.nodeId, request.color);
    } else if (request.message === "CHANGE_NODE_SIZE"){
        changeNodeSize(request.nodeId, request.size, request.tSize);
    } else if (request.message === "WILLOW_BACKGROUND_RESET_NODE_SIZES") {
        resetNodeSizes(request.option);
    } else if (request.message === "WILLOW_BACKGROUND_RUN_LAYOUT") {
        handleRunLayoutMessage(request.option); // func. def. explains weird naming.
    } else if (request.message === "WILLOW_BACKGROUND_CLEAR_SESSION") {
        clearSG();
    } else if (request.message === "WILLOW_BACKGROUND_EXPORT") {
        exportJSON();
    } else if (request.message === "WILLOW_BACKGROUND_IMPORT") {
        importJSON( request.json);
    } else if(request.message === "WILLOW_BACKGROUND_ADD_COMMENT"){
        addComment(request.nodeId, request.comment);
    }
    else if(request.message === "WILLOW_SEARCH_URL")
    {
        console.log("URL_TO_SEARCH", request.URL_TO_SEARCH );
        searchURL(request.URL_TO_SEARCH);
    }
    else if(request.message === "WILLOW_REMOVE_ALL_HIGHLIGHTS" )
    {
        removeAllHighlights();
    }

}

async function searchURL( word)
{
    //alert("searching");
    console.log("word", word );
    word = word.toLowerCase();

    //Remove highlighted(found) nodes if any
    //let collectionToRemoveHighlight = cy.elements('node[foundBySearch = 1]');
    //addRemoveHighlight(collectionToRemoveHighlight, true);
      cy.nodes().forEach(function( ele )
    {
        if(ele.data("foundBySearch") === 1)
        {
            ele.data("foundBySearch", 0);
            console.log("already highlighted",ele.id(),ele.data("foundBySearch"));
        }
    });

    //Highlight matched nodes
    let found = false;
    cy.nodes().forEach(function( ele ){
        let lowerCaseURL = ele.id().toLowerCase();
        let lowerCaseTitle = ele.data('title').toLowerCase();
        if( lowerCaseURL.includes(word) || lowerCaseTitle.includes(word) )
        {
            found = true;
            ele.data("foundBySearch", 1);
            console.log(ele.id());
        }
    });
    if(!found)
    {
        alert("Nothing found");
    }
    //let collectionToHighlight = cy.elements('node[foundBySearch = 1]');
    //addRemoveHighlight(collectionToHighlight, false);
    broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST", notifyActiveTab: true});
}
function removeAllHighlights()
{
    cy.nodes().forEach(function( ele )
    {
        if(ele.data("foundBySearch") === 1)
        {
            ele.data("foundBySearch", 0);
            console.log("already highlighted trying to remove",ele.id(),ele.data("foundBySearch"));
        }
    });
    broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST", notifyActiveTab: true});

}
function runLayout(){
    //container.style.width = '300px';
    //console.log(cy.width());
    cy.layout({

        name: 'fcose',
        quality: "proof",
       // fit: true,
        padding: 30,
        animate: false,
        randomize: false,
        nodeDimensionsIncludeLabels: true,
        packComponents: true,
        //spacingFactor: 0.77,

        //contraints
        fixedNodeConstraint: undefined, //fixedCon,
        alignmentConstraint: undefined,
        relativePlacementConstraint: undefined,

        idealEdgeLength: edge => {
            if(edge.data("discovering"))
                return 20;
            else return 100;
        },
        //idealEdgeLength:20,

        ready: () => {},
        stop: () => {}
    }).run();

}

/**
 * Non-incremental version of runLayout()
 */
function recalcLayout() {
  //  container.style.width = '300px';
     cy.layout({
        name: 'fcose',
        quality: "proof",
      //  fit: true,
        padding: 30,
        animate: false,
        randomize: true,
        nodeDimensionsIncludeLabels: true,
        packComponents: true,
        /*spacingFactor: 0.69,*/

        //contraints
        fixedNodeConstraint: undefined, //fixedCon,
        alignmentConstraint: undefined,
        relativePlacementConstraint: undefined,

        idealEdgeLength: edge => {
            if(edge.data("discovering"))
                return 40;
            else return 200;
        },

    }).run();
    console.log(cy.width());

}

/**
 * Names thus since runLayout() is taken.
 * Would make sense to rename that to runIncrementalLayout or someting similar but
 * I'm leaving it as it is in order not to confuse the rest of the team.
 */
function handleRunLayoutMessage(option) {
    if (option === "incremental") {
        runLayout();
        // alert("hande run layout");
         broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST_WINDOW_PANEL", notifyActiveTab:true});
    } else if (option === "recalculate") {
        recalcLayout();
        // alert("how is it");
        broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST_WINDOW_PANEL", notifyActiveTab:true});
    } else {
        //console.error("run layout request with invalid option");
    }
}


/*
function addFixedNodes(nodeId, newPos, newNode){
    
    if (newNode) {
        runLayout();  //so that the layout can decide its position     
        
        var newPos = {x: cy.getElementById(nodeId).position('x'), y: cy.getElementById(nodeId).position('y')};
        var fixedNode = {
            nodeId : nodeId,
            position: newPos
        };
        fixedCon.push(fixedNode); 

        //cy.getElementById(nodeId).position(newPos);
    }
    else {
      
        fixedCon.forEach(function (item) {
            if (item.nodeId == nodeId)
            {
                found = 1;
                item.nodeId = nodeId;
                item.position.x = newPos.x;
                item.position.y = newPos.y;
            }

        });
    }
   
}*/