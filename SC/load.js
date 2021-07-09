/****************************************************************************
* (c) 2018 iniNet Solutions GmbH
* FILENAME:     load.js
* DESCRIPTION:  Implements loader for jquerry and hmi min js libs
* MODIFICATIONS: 2018.07.02/vf:   modif so no more have to reference the needed to load js files in html calling file
****************************************************************************/
/*global pako,Loader,BlobMngr */
/* exported getBlobUrlViaFileName,CBlobManager,CLoader  */


var fileName2BlobInfo = {};
var url2BlobInfo = {};
var loadCount = 0;
var lTimeOut = 15000; // 15 sec timeout
var callPostProcessingCnt = 0;

//since IE does not support CustomeEvent we have to polyfill it here
(function()
{

	if (typeof window.CustomEvent === "function") return false;

	function CustomEvent(event, params)
	{
		params = params || { bubbles: false, cancelable: false, detail: undefined };
		var evt = document.createEvent("CustomEvent");
		evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
		return evt;
	}

	CustomEvent.prototype = window.Event.prototype;
	window.CustomEvent = CustomEvent;
})();


var isLDefined = function(aArg,aType)
{
	try 
	{
		if( (typeof aArg === "undefined") 
		 || (aArg == undefined) 
		 || (aArg == null)
		)
		{
			return false;
		}
		else if( ((typeof aType === "string") && (typeof aArg === aType))
		 || 	 ((typeof aType === "undefined") || (aType == undefined) || (aType == null)) 
		)
		{
			return true;
		}
		else
		{
			return false;
		}
	}
	catch (Err)
	{
		console.log("Error in Loadjs.isLDefined() : " + Err);
	}
};

var sendReqAsynch = function(aUrl, aCallBack)
{
	let output;
	var xhr = new XMLHttpRequest();

	if ((!isLDefined(aUrl, "string"))
	|| (!isLDefined(aCallBack, "function"))
	)
	{
		return false;
	}
	xhr.open("GET", aUrl, true);
	xhr.responseType = "arraybuffer";	
	xhr.overrideMimeType("text\/plain; charset=x-user-defined");
	xhr.timeout = lTimeOut;
	xhr.addEventListener("load", function()
	{
		let buffer = xhr.response;
		if (buffer.byteLength > 3)
		{
			let binData = new Uint8Array(buffer);
			if ((binData[0] == 31)
			 && (binData[1] == 139)
			 && (binData[2] == 8)
			 && isLDefined(pako)
			)
			{
				output = pako.inflate(binData);
			}
			else
			{
				output = buffer;
			}
		}
		if (isLDefined(aCallBack, "function"))
		{
			aCallBack(aUrl, output);
		}
	});
	xhr.addEventListener("timeout", function()
	{
		console.log("Timeout blob mapper: " + aUrl + " loading timed out!\nInitiating new request....");
		sendReqAsynch(aUrl, aCallBack);
	});
	xhr.addEventListener("progress", function(e)
	{
		console.log("Progress blob mapper: " + aUrl + " loaded: " + e.loaded + "/" + e.total + "....");
	});
	xhr.addEventListener("error", function()
	{
		throw ("Error blob mapper: Error status: " + this.status.toString());
	});
	xhr.send();
};

var giveMimeType = function(aFileName)
{
	try 
	{
		if (!isLDefined(aFileName, "string"))
		{
			return "";
		}
		switch (true)
		{
			case aFileName.indexOf(".svgz") >= 0:
				// Fall through
			case aFileName.indexOf(".svg") >= 0:
				return "image/svg+xml";
			case aFileName.indexOf(".png") >= 0:
				return "image/png";
			case aFileName.indexOf(".gif") >= 0:
				return "image/gif";
			case aFileName.indexOf(".js") >= 0:
				return "application/javascript";
			case aFileName.indexOf(".htm") >= 0:
				// Fall through
			case aFileName.indexOf(".html") >= 0:
				return "text/html";
			case aFileName.indexOf(".xml") >= 0:
				return "application/xml";
			case aFileName.indexOf(".csv") >= 0:
				return "text/csv";
			default: return "text/plain";
		}
	}
	catch (Err)
	{
		console.log("Error in Loadjs.giveMimeType() : " + Err);
	}
};


var giveFileExtension = function(aMimeType)
{
	try
	{
		if (!isLDefined(aMimeType, "string"))
		{
			return "";
		}
		switch (true)
		{
			case aMimeType.indexOf("image/svg+xml") >= 0:
				return ".svg";
			case aMimeType.indexOf("image/png") >= 0:
				return ".png";
			case aMimeType.indexOf("image/gif") >= 0:
				return ".gif";
			case aMimeType.indexOf("application/javascript") >= 0:
				return ".js";
			case aMimeType.indexOf("text/html") >= 0:
				return ".html";
			case aMimeType.indexOf("application/xml") >= 0:
				return ".xml";
			case aMimeType.indexOf("text/csv") >= 0:
				return ".csv";
			default: return ".txt";
		}
	}
	catch (Err)
	{
		console.log("Error in Loadjs.giveFileExtension() : " + Err);
	}
};

var getBlobInfoViaUrl = function(aUrl)
{
	var result = null;

	try 
	{
		if ((isLDefined(aUrl, "string"))
		 && (isLDefined(url2BlobInfo))
		 && (isLDefined((result = url2BlobInfo[aUrl]), "object"))
		)
		{
			return result;
		}
	}
	catch (Err)
	{
		console.log("Error in Loadjs.getBlobInfoViaUrl() : " + Err);
	}
	return null;
};

function getBlobUrlViaUrl(aUrl)
{
	var result = null;
	
	try
	{
		result = getBlobInfoViaUrl(aUrl);
		if ((isLDefined(result, "object"))
		 && (isLDefined(result = result.bloburl, "string"))
		)
		{
			return result;
		}
	}
	catch (Err)
	{
		console.log("Error in Loadjs.getBlobUrlViaUrl() : " + Err);
	}
	return null;
}

var blobInserter = function(aContents, aUrl, aMimeType, aJsIncludFunc)
{
	var lBlobInstance = null;
	var lBlobUrl = "";
	let lFileName = "";
	
	try
	{
		if (isLDefined(lBlobUrl = getBlobUrlViaUrl(aUrl)))
		{
			return lBlobUrl;
		}
		if ((!isLDefined(aContents))
		 || (!isLDefined(aUrl, "string"))
		 || (!isLDefined(aMimeType, "string"))
		 || (!isLDefined(fileName2BlobInfo))
		 || (!isLDefined(url2BlobInfo))
		)
		{
			return null;
		}
		lBlobInstance = new Blob([aContents], { type: aMimeType });
		if (!isLDefined(lBlobInstance))
		{
			return null;
		}
		lBlobUrl = URL.createObjectURL(lBlobInstance);
		if (!isLDefined(lBlobUrl))
		{
			return null;
		}
		lFileName = aUrl.substring(aUrl.lastIndexOf("/") + 1);
		if (!isLDefined(lFileName))
		{
			return null;
		}
		lFileName = lFileName.slice(0, lFileName.indexOf(".")) + giveFileExtension(aMimeType);
		fileName2BlobInfo[lFileName] = url2BlobInfo[aUrl] = { bloburl: lBlobUrl, filename: lFileName, url: aUrl, mimetype: aMimeType, blob: lBlobInstance };
		if( (isLDefined(aJsIncludFunc, "function"))
		 && (aMimeType == "application/javascript")
		)
		{
			aJsIncludFunc(lBlobUrl, lFileName);
		}
		loadCount++;
	}
	catch (Err)
	{
		console.log("Error in Loadjs.blobInserter() : " + Err);
	}
	return lBlobUrl;
};

var getBloBInfoViaFileName = function(aFileName)
{
	var result = null;
	
	try
	{	
		if ((isLDefined(aFileName, "string"))	 
		 && (isLDefined(fileName2BlobInfo))
		 && (isLDefined((result = fileName2BlobInfo[aFileName]), "object"))
		)
		{
			return result;
		}
	}
	catch (Err)
	{
		console.log("Error in Loadjs.getBloBInfoViaFileName() : " + Err);
	}
	return null;
};

function getBlobUrlViaFileName(aFileName)
{
	var result = null;
	
	try 
	{
		result = getBloBInfoViaFileName(aFileName);
		if ((isLDefined(result, "object"))
		 && (isLDefined(result = result.bloburl, "string"))
		)
		{
			return result;
		}
	}
	catch (Err)
	{
		console.log("Error in Loadjs.getBlobUrlViaFileName() : " + Err);
	}
	return null;
}


//
// createNode
// function for creating a node in the DOM
var createNode = function (aName, aAttrObj, aNs)
{
	var aNode = null;

	try
	{
		if (!isLDefined(aName, "string"))
		{
			return null;
		}

		if (isLDefined(aNs, "string"))
		{
			aNode = document.createElementNS(aNs, aName);
		}
		else
		{
			aNode = document.createElement(aName);
		}
		if (isLDefined(aAttrObj, "object"))
		{
			for (var lKey in aAttrObj)
			{
				aNode.setAttribute(lKey, aAttrObj[lKey]);
			}
		}
	}
	catch (Err)
	{
		console.log("Error in Loadjs.createNode() : " + Err);
	}
	return aNode;
};

//
// PostProcessing()
// method that is called after everything
// in the load list has been loaded. Cleans up and
// starts the call back function for the program propper
var PostProcessing = function()
{
	try
	{
		if (!isLDefined(Loader))
		{
			return null;
		}
		if( (isLDefined(Loader.headTag, "object"))
		 && (isLDefined(Loader.dummyEventTag))
		)
		{
			//Loader.dummyEventTag.remove();
			Loader.headTag.removeChild(Loader.dummyEventTag);
			Loader.dummyEventTag = null;
		}
		if (isLDefined(Loader.callBack, "function"))
		{
			Loader.callBack();
		}
	}
	catch (Err)
	{
		console.log("Error in Loadjs.PostProcessing() : " + Err);
	}
};

//
// maybePostProcessing()
// the files are loaded twice : 1 from server, then when added in DOM
var maybePostProcessing = function()
{
	try 
	{
		if ((++callPostProcessingCnt) == 2)
		{
			PostProcessing();
		}
	}
	catch (Err)
	{
		console.log("Error in Loadjs.maybePostProcessing() : " + Err);
	}
};




//
// createScriptNode()
// method for creating a script node
var createScriptNode = function(aUrl, aAddHandler)
{
	var lNode = null;
	
	try
	{
		if (!isLDefined(Loader))
		{
			return null;
		}

		if (isLDefined(aUrl, "string"))
		{
			lNode = createNode("script", { type: "text/javascript", src: aUrl });
			if ((!isLDefined(aAddHandler))
			 || (aAddHandler == true)
			)
			{
				lNode.addEventListener("load", function() { Loader.scriptLoadCnt++; if (Loader.files2LoadList.length == Loader.scriptLoadCnt) maybePostProcessing(); });
			}
		}
	}
	catch (Err)
	{
		console.log("Error in Loadjs.createScriptNode() : " + Err);
	}
	return lNode;
};


//
// attachScriptNode()
// method for creating and attaching a script node
// in the DOM. When a comment is given a comment node will be added.
// Important when blob urls are used (don't have reference to)
// original file name
var attachScriptNode = function(aUrl, aComment)
{
	var lNode = null;
	var lCommentNode = null;
	
	try
	{
		if (!isLDefined(Loader))
		{
			return null;
		}

		if (isLDefined(Loader.headTag, "object"))
		{
			if (isLDefined(aComment, "string"))
			{
				lCommentNode = document.createComment(aComment);
				if (isLDefined(lCommentNode, "object"))
				{
					Loader.headTag.appendChild(lCommentNode);
				}
			}
			if (isLDefined(aUrl, "string"))
			{
				lNode = createScriptNode(aUrl);
				if (isLDefined(lNode, "object"))
				{
					Loader.headTag.appendChild(lNode);
				}
			}
		}
	}
	catch (Err)
	{
		console.log("Error in Loadjs.attachScriptNode() : " + Err);
	}
};



//
// CBlobManager class definition
var CBlobManager = function()
{
	this.insert = function(aUrl, aListLength, aEventTarget, aJsIncludeFunc)
	{
		var lMimeType = "image/svg+xml";
		
		try 
		{
			if (!isLDefined(aUrl, "string"))
			{
				return false;
			}

			lMimeType = giveMimeType(aUrl);
			sendReqAsynch(aUrl, function(anUrl, anContent) {
				var lEvent;

				if (blobInserter(anContent, anUrl, lMimeType, aJsIncludeFunc) != null)
				{
					if (isLDefined(aEventTarget))
					{
						lEvent = new CustomEvent("fileloaded", { detail: anUrl });
						aEventTarget.dispatchEvent(lEvent);
					}
				}

				if (isLDefined(aListLength, "number") && (loadCount == aListLength))
				{
					lEvent = new CustomEvent("finishedloadingfiles", { detail: loadCount });
					aEventTarget.dispatchEvent(lEvent);
				}
			});
			return true;
		}
		catch (Err)
		{
			console.log("Error in Loadjs CBlobManager.insert() : " + Err);
		}
		return false;		
	};
}; 


//
// Cloader class definition and constructor
// First argument:  end of load callback function
var CLoader = function()
{
	this.headTag = null;
	this.dummyEventTag = null;
	this.files2LoadList = new Array();
	this.callBack = null;
	this.pakoAlreadyLoaded = false;
	this.scriptLoadCnt = 0;
	
	//
	// createDummyEventElement()
	// method for creating a <div> that will handle finished loading events
	this.createDummyEventElement = function()
	{
		try
		{
			this.dummyEventTag = createNode("div", { id: "EventDummy" });
			if (isLDefined(this.headTag) && isLDefined(this.dummyEventTag))
			{
				this.headTag.appendChild(this.dummyEventTag);				
			}
			else
			{
				return false;
			}
			this.dummyEventTag.addEventListener("fileloaded", function(aEvent) { console.log("File loaded: " + aEvent.detail); });
			this.dummyEventTag.addEventListener("finishedloadingfiles", function(aEvent) { console.log("Finished loading: " + aEvent.detail + " files!"); maybePostProcessing(); });
			return true;
		}
		catch (Err)
		{
			console.log("Error in Loadjs CLoader.createDummyEventElement() : " + Err);
		}
		return false;
	};

	//
	// Init() method to initialise the loader instance
	this.Init = function(aListArr)
	{
		var lNode = null;

		try
		{
			if (!isLDefined(aListArr, "object"))
			{
				return;
			}			
			this.files2LoadList.length = 0;
			this.files2LoadList.push("jquery.js");
			this.files2LoadList.push("teqreader.js");
			this.files2LoadList.push("jszip_min.js");
			this.files2LoadList.push("teqreader_worker.js");

			this.headTag = document.getElementsByTagName("head")[0];
			if (typeof pako === "undefined")
			{
				lNode = createScriptNode("pako_inflate_min.js", false);
				lNode.addEventListener("load", function() { this.Do(); });
				if( (isLDefined(this.headTag))
				 && (isLDefined(lNode))
				)
				{
					this.headTag.appendChild(lNode);
				}
			}
			else
			{
				this.pakoAlreadyLoaded = true;
			}

			if (isLDefined(aListArr["0"], "function"))
			{
				this.callBack = aListArr["0"]; 					   
			}
			this.createDummyEventElement();                        // We need for event handeling
		}
		catch (Err)
		{
			console.log("Error in Loadjs CLoader.Init() : " + Err);
		}
	};

	this.Init(arguments);

	//
	// Do()
	// method that will load all other files after initial scripts have been loaded.
	this.Do = function()
	{
		var lIndex = 0;
		var listLength = 0;
		
		try
		{
			if (!isLDefined(BlobMngr, "object"))
			{
				return false;
			}
			listLength = this.files2LoadList.length;
			for (lIndex = 0; lIndex < listLength; lIndex++)
			{
				if (BlobMngr.insert(this.files2LoadList[lIndex], listLength, this.dummyEventTag, attachScriptNode) == false)
				{
					console.log("Error: couldn't load #" + lIndex + " : " + this.files2LoadList[lIndex] + " in Blob Manager!");
				}
			}
			return true;
		}
		catch (Err)
		{
			console.log("Error in Loadjs CLoader.Do() : " + Err);
		}
		return false;
	}; 


	if (this.pakoAlreadyLoaded == true)
	{
		this.Do();
	}
}; 