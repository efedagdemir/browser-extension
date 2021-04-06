
var cy = null; // The variable that holds the cytoscape object.
//var fixedCon = []; // The variable that holds fixed node positions

/**
 * Initalizes the session graph as a cytoscape object with no elements.
 */
function initializeSG() {
    // create an HTML container for the graph in the background page
    //* This page is not rendered, the container's sole purpose is to enable cytospace.js to work properly.
    let container = document.createElement("div");
    // ! This is problematic! 
    container.style.width = container.style.height = "300px"; // random values for width and height.
    document.body.appendChild(container);

    cy = cytoscape({
        container: container,
        style: [ // the stylesheet for the graph
            {
              selector: 'node',
              style: {
                'label': 'data(title)'
              }
            },
        ],
        ready: function () {
            // ready 1
        }
    });
}

/**
 * Loads the given graph into session graph.
 * @param {Object} cyJson Cytoscape JSON export.
 */
function loadSG(cyJson) {
    cy.json(cyJson);
}

/**
 * Clearss the session graph.
 */
function clearSG(){
    cy.remove(cy.elements());
    initialize();
    broadcastSyncRequest({message: "WILLOW_GRAPH_SYNC_REQUEST", notifyActiveTab: true});
}

function getCytoscapeJSON(){
    return cy.json(true);
}

function updateNodePosition(nodeId, newPos) {
    console.log("UPDATING", nodeId);
    cy.getElementById(nodeId).position(newPos);
    //addFixedNodes(nodeId, newPos, 0);
   
}

function removeNode(nodeId) {

    console.log("DELETING NODE");
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
    return true;
}

function openPage(nodeId) {
    //! This results in an edge because the transition type of the visit caused by this function is "link".
    openingFromGraph.set(nodeId, true);

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        var tab = tabs[0];
        chrome.tabs.update(tab.id, {url: nodeId});
    });
    return true;
}

function openPageInNewTab(nodeId) {
    chrome.tabs.create({url: nodeId});
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
        hexColorValue = '#E81414';
    else if (color == "green")
        hexColorValue = '#50b46e';
    else if (color == "blue")
        hexColorValue = '#1444E8';
    
    //TODO asagidaki commentler farkli denemeler ama henuz hicbiri duzgun calismadi
    /*let node = cy.getElementById(nodeId);
    node.style({'border-color': hexColorValue});*/
    //node.style('border-color', hexColorValue);
    //cy.$(nodeId).style('border-color', hexColorValue);
    //cy.style().selector('node').style('border-color', hexColorValue).update();
    //cy.style().$(nodeId).style('border-color', hexColorValue).update();
}

function messageReceived(request, sender, sendResponse) {
    if (request.type == "getCytoscapeJSON") {
        sendResponse(this.getCytoscapeJSON());
    } else if (request.message == "WILLOW_BACKGROUND_UPDATE_NODE_POS") {
        updateNodePosition(request.nodeId, request.newPos);
    } else if (request.message == "WILLOW_BACKGROUND_REMOVE_NODE") {
        removeNode(request.nodeId);
    } else if (request.message == "WILLOW_BACKGROUND_OPEN_PAGE") {
        openPage(request.nodeId);
    } else if (request.message == "WILLOW_BACKGROUND_OPEN_PAGE_IN_NEW_TAB") {
        openPageInNewTab(request.nodeId);
    } else if (request.message == "WILLOW_BACKGROUND_REMOVE_EDGE") {
        removeEdge(request.source, request.target);
    } else if (request.message == "WILLOW_BACKGROUND_CHANGE_BORDER_COLOR") {
        changeBorderColor(request.nodeId, request.color);
    } else if (request.message == "WILLOW_BACKGROUND_CLEAR_SESSION") {
        clearSG();
    }

}


function runLayout(){

    cy.layout({
        
        name: 'fcose',
        quality: "proof",
        fit: true, 
        padding: 30,
        animate: false,
        randomize: false,
        nodeDimensionsIncludeLabels: true,
        packComponents: true,
       
        //contraints
        fixedNodeConstraint: undefined, //fixedCon,
        alignmentConstraint: undefined,
        relativePlacementConstraint: undefined,

        ready: () => {},
        stop: () => {}                 
    }).run();
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