/****************************************************************************
* (c) 2016 iniNet Solutions GmbH
* FILENAME:     teqreader_worker.js
* DESCRIPTION:  Implements the spider write values to server in a separate thread from GUI thread 
*				since the write val needs to be done in a blocking way
* MODIFICATIONS:   06.10.2016/vf:   initial source code
****************************************************************************/
/*global self*/
/*exported onmessage,onerror*/

//https: //developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers
//http://www.codeproject.com/Articles/168604/Combining-jQuery-Deferred-with-the-HTML-Web-Worker



var g_ajaxTimeout = 10000;
var g_target_type_nr = 100;
var g_SrvInfo_ILRDelayActiv = false;
var g_lastWriteValReqMs = 0;
var isInit = 0;

onerror = function (error)
{
	if ((error !== null)
		&& (error !== undefined)
	)
	{
		throw error;
	}
};


// "cmd": "writeVal", "sc.AjaxTimeout": sc.AjaxTimeout.toString(), "requestURLWriteVal": requestURLWriteVal }); ; // Sending message as an array to the worker
onmessage = function(e) 
{
	let data = e.data;
	if (data.cmd === "isInit")
	{
		self.postMessage({ "cmd": data.cmd, "value": isInit.toString() });
	}

	else if (data.cmd === "init")
	{
		let tempStr = data.ajaxTimeout;
		let tempi = parseInt(tempStr, 10);
		if (isNaN(tempi) === false)
		{
			g_ajaxTimeout = tempi;
		}

		tempStr = data.target_type_nr;
		tempi = parseInt(tempStr, 10);
		if (isNaN(tempi) === false)
		{
			g_target_type_nr = tempi;
		}

		tempStr = data.SrvInfo_ILRDelayActiv;
		if (tempStr === "true")
		{
			g_SrvInfo_ILRDelayActiv = true;
		}
		else
		{
			g_SrvInfo_ILRDelayActiv = false;
		}

		isInit = 1;
		self.postMessage({ "cmd": data.cmd, "value": isInit.toString() });
	}
	else if (data.cmd === "writeVal")
	{
		if (data.requestURLWriteVal.length > 0)
		{
			try
			{
				let WriteValSleepMs = 0;
				let tempStr = data.WriteValSleepMs;
				let tempi = parseInt(tempStr, 10);
				if (isNaN(tempi) === false)
				{
					WriteValSleepMs = tempi;
				}
				if ((WriteValSleepMs > 0)
				 && (g_SrvInfo_ILRDelayActiv !== true)
				)
				{
					//waits until send req
					let now_ms = new Date().getTime();
					while ((now_ms - g_lastWriteValReqMs) < WriteValSleepMs)
					{
						now_ms = new Date().getTime();
					}
				}
				g_lastWriteValReqMs = new Date().getTime();


				let xhr = new XMLHttpRequest();
				if ((xhr !== null)
                 && (xhr !== undefined)
                )
				{			
					if( (data.postWriteValContent.length > 0)
					)
					{
						//POST REQ
						xhr.open("POST", data.requestURLWriteVal, false);
					}
					else
					{
						xhr.open("GET", data.requestURLWriteVal, false);
					}					
					//!!!! xhr.timeout (For Insternet Explorer )has to be set after the xhr.open else it fails on a  InvalidStateError with ie11
					xhr.timeout = g_ajaxTimeout; //since the request is made in a synchrone way, the timeout makes sens
					xhr.onreadystatechange = function ()
					{
						if (xhr.readyState == xhr.DONE)
						{
							if (xhr.status == 200 /*&& xhr.response*/)
							{
								if ((xhr.statusText !== null)
									&& (xhr.statusText !== undefined)
								)
								{
									self.postMessage({ "cmd": data.cmd, "value": data.requestURLWriteVal, "ret": "Done with succes \ncgi ajax returned xhr.status = " + xhr.status + "\n xhr.statusText = " + xhr.statusText });
								}
								else
								{
									self.postMessage({ "cmd": data.cmd, "value": data.requestURLWriteVal, "ret": "Done with succes \ncgi ajax returned no status text for xhr.status = " + xhr.status });
								}
							}
							else
							{
								self.postMessage({ "cmd": data.cmd, "value": data.requestURLWriteVal, "ret": "Done but failed xhr.status = " + xhr.status });
							}
						}
					};
					if( (data.postWriteValContent.length > 0)
					)
					{
						xhr.send(data.postWriteValContent);
					}
					else
					{
						xhr.send();
					}
				}
			}
			catch (err)
			{
				self.postMessage({ "cmd": data.cmd, "value": data.requestURLWriteVal, "ret": "Done but failed nerr =  " + err });
			}
		}
	}
};