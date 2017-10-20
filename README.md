# SpendifiJS Server for Slack

** Keep track of your day to day expenses with SpendifiJS. This package allows you to install SpendifiJS on your server and send and receive spend requests that can be accepted and rejected directly in Slack. **

* **[Workflow](#workflow)**
* **[Features](#features)**
* **[Requests via Text (video)](#reqtext)**
* **[Requests via Photo (video)](#reqphoto)**
* **[Image processing through SWT](#swt)**
* **[Package Dependencies](#dependencies)**
* **[How to install](#how-to-install)**

<a name="workflow"></a>

### Workflow

![](https://ezway-imagestore.s3.amazonaws.com/files/2017/10/5383913201508408928.png)

![](https://ezway-imagestore.s3.amazonaws.com/files/2017/10/2189779931508445645.png)

<a name="features"></a>

### Features

- BPMN connection to ProcessMaker.io, to accept and reject spend requests.
- Image recognition to extract amounts and descriptions from receipts.
- Stroke Width Transform  integration in JavaScript for rapid text detection.
- NodeJS server to handle HTTP requests.
- Support for Slack Events API to handle messages and files sent in channels.
- Support for Add to Slack button.

<a name="reqtext"></a>

### Sending requests via Text

This video shows how easy it is to send a Spend Request with SpendifiJS in Slack.

[![Spendifi via Text](https://img.youtube.com/vi/ZWda8tG8BWc/0.jpg)](https://www.youtube.com/watch?v=ZWda8tG8BWc)

<a name="reqphoto"></a>

### Sending requests via Photo

This video shows the process of sending a Spend Request with SpendifiJS via photo.

[![Spendifi via Photo](https://img.youtube.com/vi/mWuRhX72q9M/0.jpg)](https://www.youtube.com/watch?v=mWuRhX72q9M)

<a name="swt"></a>

### Image processing through SWT

[The Stroke Width Transform (SWT)](http://www.math.tau.ac.il/~turkel/imagepapers/text_detection.pdf "The Stroke Width Transform (SWT)") is still considered one of the best text detection algorithms out there. It was implemented in JavaScript as an experiment for this project, but it can easily be ported to C++11 and invoked using the JS bindings contained in this project.

We start by detecting edges using a canny filter. Once we find the biggest polygon we crop the image around it and reduce its resolution to imporve performance. After that we apply the SWT filter to the image and look for the components / letters in it. After that we apply a classifier (Depth First Search) to find lines of components (words / sentences) and remove the unwanted components. Finally we pass the resulting image through OCR and look for the amount and description:

![](https://ezway-imagestore.s3.amazonaws.com/files/2017/10/8203600801508443358.png)

**Note:** There are still a lot of room for improvement like using a morphological erosion instead of looking for connected components using their heights, a dynamic thresholding to remove unwanted components, etc. Please leave an issue if you think of something else.

<a name="dependencies"></a>

### Dependencies

- **[NodeJS 6.2.2](https://nodejs.org/)**
- **[OpenCV 3.2.0](https://opencv.org/releases.html)**
- **[opencv4nodejs 2.4.0](https://github.com/justadudewhohacks/opencv4nodejs/)**
- **[TesseractJS 1.0.10](https://github.com/justadudewhohacks/opencv4nodejs/)**
- **[Slack App](https://api.slack.com/)**

<a name="how-to-install"></a>

### How to Install

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
		$ export SLACKTEAMID=yourSlackTeamId
		$ export SLACKTEAMNAME=yourSlackTeamName
		$ export SLACKOAUTHTOKEN=yourSlackOauthToken
		$ export SLACKBOTOAUTHTOKEN=yourSlackBotOauthToken
		$ export SLACKBOTUSERID=yourBotUserID
- Start the server with **node server.js**
