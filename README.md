# SpendifiJS Server for Slack

** Keep track of your day to day expenses with SpendifiJS. This package allows you to install SpendifiJS on your server and send and receive spend requests that can be accepted and rejected directly in Slack. **

* **[Workflow](#workflow)**
* **[Features](#features)**
* **[Requests via Text (video)](#reqtext)**
* **[Requests via Photo (video)](#reqphoto)**
* **[Package Dependencies](#dependencies)**
* **[How to install](#how-to-install)**

<a name="workflow"></a>

###Workflow

![](https://ezway-imagestore.s3.amazonaws.com/files/2017/10/5383913201508408928.png)

```flow
st=>start: User sends spend request in Slack
op=>operation: The request is received and stored
cond=>condition: Is the request a photo?
swt=>operation: Extract the info from the image
e=>operation: Send info to Slack for approval
en=>end: Notify the user

st->op->cond
cond(yes)->swt->e->en
cond(no)->e->en
```

<a name="features"></a>

###Features

- BPMN connection to ProcessMaker.io, to accept and reject spend requests.
- Image recognition to extract amounts and descriptions from receipts.
- Stroke Width Transform  integration in JavaScript for rapid text detection.
- NodeJS server to handle HTTP requests.
- Support for Slack Events API to handle messages and files sent in channels.
- Support for Add to Slack button.

<a name="reqtext"></a>

###Sending requests via Text

This video shows how easy it is to send a Spend Request with SpendifiJS in Slack.

[![Spendifi via Text](https://img.youtube.com/vi/ZWda8tG8BWc/0.jpg)](https://www.youtube.com/watch?v=ZWda8tG8BWc)

<a name="reqphoto"></a>

###Sending requests via Photo

This video shows the process of sending a Spend Request with SpendifiJS via photo.

[![Spendifi via Text](https://img.youtube.com/vi/ZWda8tG8BWc/0.jpg)](https://www.youtube.com/watch?v=ZWda8tG8BWc)

<a name="dependencies"></a>

###Dependencies

- **[NodeJS 6.2.2](https://nodejs.org/)**
- **[OpenCV 3.2.0](https://opencv.org/releases.html)**
- **[opencv4nodejs 2.4.0](https://github.com/justadudewhohacks/opencv4nodejs/)**
- **[TesseractJS 1.0.10](https://github.com/justadudewhohacks/opencv4nodejs/)**
- **[Slack App](https://api.slack.com/)**

<a name="how-to-install"></a>

###How to Install

**On your server**
- Install NodeJS on your server (https://nodejs.org/).
- Install OpenCV 3.2.0 and all its dependencies (http://web.cs.sunyit.edu/~realemj/guides/installOpenCVandBoost.html).

**On ProcessMaker.io**
- Create a new instance. Copy the API URL (https://YOURINSTANCEID.api.processmaker.io/api/v1).

**On api.slack.com**
- Create a new App.
- Enable the **Interactive Components** for your app using the ProcessMaker.io URL (https://YOURINSTANCEID.api.processmaker.io/api/v1/processes/Slack%20Action%20Receiver/events/Slack%20Response%20Received/webhook).
- Enable the slash commands
- Create a slash command called **"/spendifi"**and two variables for the usage hints **"[amount $##.##] [descriptionNoSpaces text]"**
- Enable Event Subscriptions using a secure link to your NodeJS server and the following subscriptions:
	- message.channels
	+ message.im
	+ message.mpim
	+ message.groups
- Create a bot for your app and enable the option **"Always Show My Bot as Online "**
- Go to **"OAuth & Permissions"** and copy your Bot User OAuth Access Token

**On Slack**
- Create a new channel called **testprocess**

**On your server**
- Clone this repo in your server
- Edit the BPMN file provided in the repo **"slack.bpmn"** to add your Bot User OAuth Access Token:
		aData.bot_token="xoxb-YOURSLACKBOT-ACCESSTOKEN";
- Create new environment variables using your Slack App Details (and save them to your bash_profile file)
		$ export SLACKCLIENTID=yourSlackId
		$ export SLACKCLIENTSECRET=yourSlackAppSecret
		$ export SLACKVERIFICATIONTOKEN=yourSlackToken
- Start the server with **node server.js **
