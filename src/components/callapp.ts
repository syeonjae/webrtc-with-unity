import * as awrtc from "./awrtc/index";
import { Media, MediaConfig, WebRtcHelper } from "./awrtc/index";
export class CallApp {
  private mAddress;
  private mNetConfig = new awrtc.NetworkConfig();
  private mCall: awrtc.BrowserWebRtcCall = null;

  //update loop
  private mIntervalId: any = -1;

  private mRemoteVideo = {};

  private mIsRunning = false;
  //true on startup, false once first config completed and connection attempts are made
  private mWaitForInitialConfig = true;

  private mAutoRejoin = true;

  public constructor() {
    this.mNetConfig.IceServers = [
      { urls: "stun:t.y-not.app:443" },
      { urls: "stun:stun.l.google.com:19302" },
    ];
    this.mNetConfig.IsConference = false;
    this.mNetConfig.SignalingUrl = "wss://s.y-not.app/callapp";
    this.mAddress = "dev";
  }

  private GetParameterByName(name) {
    const url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return "";
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  }
  private tobool(value, defaultval) {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;

    return defaultval;
  }

  public Start(): void {
    if (this.mCall != null) this.Cleanup();

    this.mIsRunning = true;
    this.Ui_OnStart();
    console.log("start");
    console.log("Using signaling server url: " + this.mNetConfig.SignalingUrl);

    //create media configuration
    const config = this.mMediaConfig;
    config.IdealFps = 30;

    //For usage in HTML set FrameUpdates to false and wait for  MediaUpdate to
    //get the VideoElement. By default awrtc would deliver frames individually
    //for use in Unity WebGL
    console.log("requested config:" + JSON.stringify(config));
    //setup our high level call class.
    this.mCall = new awrtc.BrowserWebRtcCall(this.mNetConfig);

    //handle events (get triggered after Configure / Listen call)
    //+ugly lambda to avoid loosing "this" reference
    this.mCall.addEventListener((sender, args) => {
      this.OnNetworkEvent(sender, args);
    });

    //As the system is designed for realtime graphics we have to call the Update method. Events are only
    //triggered during this Update call!
    this.mIntervalId = setInterval(() => {
      this.Update();
    }, 50);

    this.mWaitForInitialConfig = true;
    //configure media. This will request access to media and can fail if the user doesn't have a proper device or
    //blocks access
    this.mCall.Configure(config);

    //Now we wait for the "ConfigurationComplete" event to continue
  }

  public Reconfigure(new_config: MediaConfig) {
    const old_config = this.mMediaConfig;
    this.mMediaConfig = new_config;
    if (this.mCall !== null) {
      console.log("Trigger reconfigure from " + old_config.toString());
      console.log("to " + new_config.toString());
      this.mCall.Configure(this.mMediaConfig);
    }
  }

  public Stop(): void {
    this.Cleanup();
  }

  private CheckAutoRejoin() {
    if (this.mAutoRejoin) {
      setTimeout(() => {
        if (this.mIsRunning === false) {
          this.Start();
        }
      }, 1000);
    }
  }

  private Cleanup(): void {
    if (this.mCall != null) {
      this.mCall.Dispose();
      this.mCall = null;
      clearInterval(this.mIntervalId);
      this.mIntervalId = -1;
      this.mIsRunning = false;
      this.mRemoteVideo = {};
    }
    this.Ui_OnCleanup();
  }

  private Update(): void {
    if (this.mCall != null) this.mCall.Update();
  }

  private OnNetworkEvent(sender: any, args: awrtc.CallEventArgs): void {
    if (args.Type == awrtc.CallEventType.ConfigurationComplete) {
      console.log("configuration complete");

      if (this.mWaitForInitialConfig) {
        console.log(`Attempt to listen on ${this.mAddress}`);
        this.mCall.Listen(this.mAddress);
      }
      this.mWaitForInitialConfig = false;
    } else if (args.Type == awrtc.CallEventType.MediaUpdate) {
      const margs = args as awrtc.MediaUpdatedEventArgs;
      if (margs.ConnectionId == awrtc.ConnectionId.INVALID) {
        var videoElement = margs.VideoElement;
      } else {
        var videoElement = margs.VideoElement;
        this.Ui_OnRemoteVideo(videoElement, margs.ConnectionId);
      }
    } else if (args.Type == awrtc.CallEventType.ListeningFailed) {
      if (this.mNetConfig.IsConference == false) {
        console.log(`Attempt to call ${this.mAddress}`);
        this.mCall.Call(this.mAddress);
      } else {
        const errorMsg = "Listening failed. Offline? Server dead?";
        console.error(errorMsg);
        this.Ui_OnError(errorMsg);
        this.Cleanup();
        this.CheckAutoRejoin();
        return;
      }
    } else if (args.Type == awrtc.CallEventType.ConnectionFailed) {
      const errorMsg = "Connection failed. Offline? Server dead? ";
      console.error(errorMsg);
      this.Ui_OnError(errorMsg);
      this.Cleanup();
      this.CheckAutoRejoin();
      return;
    } else if (args.Type == awrtc.CallEventType.CallEnded) {
      const callEndedEvent = args as awrtc.CallEndedEventArgs;
      console.log("call ended with id " + callEndedEvent.ConnectionId.id);
      delete this.mRemoteVideo[callEndedEvent.ConnectionId.id];
      this.Ui_OnLog(
        "Disconnected from user with id " + callEndedEvent.ConnectionId.id
      );
      if (
        this.mNetConfig.IsConference == false &&
        Object.keys(this.mRemoteVideo).length == 0
      ) {
        this.Cleanup();
        this.CheckAutoRejoin();
        return;
      }
    } else if (args.Type == awrtc.CallEventType.Message) {
      const messageArgs = args as awrtc.MessageEventArgs;
      let type = "unreliable";
      if (messageArgs.Reliable) {
        type = "reliable";
      }
      console.warn(
        `Message from ${messageArgs.ConnectionId.id} via ${type} dc received: ${messageArgs.Content} `
      );
    } else if (args.Type == awrtc.CallEventType.DataMessage) {
      const messageArgs = args as awrtc.DataMessageEventArgs;
    } else if (args.Type == awrtc.CallEventType.CallAccepted) {
      const arg = args as awrtc.CallAcceptedEventArgs;
      console.log("New call accepted id: " + arg.ConnectionId.id);
    } else if (args.Type == awrtc.CallEventType.WaitForIncomingCall) {
      console.log("Waiting for incoming call ...");
    } else {
      console.log("Unhandled event: " + args.Type);
    }
  }

  private mMediaConfig: MediaConfig;
  private mAutostart;
  private mUiButton: HTMLButtonElement;
  private mUiRemoteVideoParent: HTMLElement;

  public setupUi(parent: HTMLElement) {
    this.mMediaConfig = new MediaConfig();

    const devname = "Screen capture";
    Media.SharedInstance.EnableScreenCapture(devname);
    this.mMediaConfig.VideoDeviceName = devname;
    this.mUiButton = parent.querySelector<any>(".callapp_button");
    this.mUiRemoteVideoParent = parent.querySelector<HTMLParagraphElement>(
      ".callapp_remote_video"
    );
    this.mUiButton.onclick = this.Ui_OnStartStopButtonClicked;

    this.UI_ParameterToUi();
    this.UI_UiToValues();

    if (this.mAutostart) {
      console.log("Starting automatically ... ");
      this.Start();
    }

    console.log(
      `setupUi: address: ${this.mAddress} + audio: ${this.mMediaConfig.Audio} video: ${this.mMediaConfig.Video} autostart: ${this.mAutostart}`
    );
  }
  private Ui_OnStart() {
    this.mUiButton.textContent = "Stop";
  }
  private Ui_OnCleanup() {
    this.mUiButton.textContent = "Join";
    while (this.mUiRemoteVideoParent.hasChildNodes()) {
      this.mUiRemoteVideoParent.removeChild(
        this.mUiRemoteVideoParent.firstChild
      );
    }
  }

  private Ui_OnRemoteVideo(video: HTMLVideoElement, id: awrtc.ConnectionId) {
    if (id.id in this.mRemoteVideo) {
      const old_video = this.mRemoteVideo[id.id];
      delete this.mRemoteVideo[id.id];
    }
    this.mRemoteVideo[id.id] = video;
    video.setAttribute("width", "100%");
    video.setAttribute("height", "100%");
    this.mUiRemoteVideoParent.appendChild(video);
  }

  public Ui_OnStartStopButtonClicked = () => {
    if (this.mIsRunning) {
      this.Stop();
    } else {
      this.UI_UiToValues();
      this.Start();
    }
  };

  private UI_ParameterToUi() {
    this.mAutostart = this.GetParameterByName("autostart");
    this.mAutostart = this.tobool(this.mAutostart, false);
  }

  public Ui_OnUpdate = () => {
    console.debug("OnUiUpdate");
    this.UI_UiToValues();
  };

  private UI_UiToValues() {
    const newConfig = this.mMediaConfig.clone();

    newConfig.Audio = false;
    newConfig.Video = false;
    this.Reconfigure(newConfig);
  }
}

export function callapp(parent: HTMLElement) {
  WebRtcHelper.EmitAdapter();
  let callApp: CallApp;
  console.log("init callapp");
  if (parent == null) {
    console.log("parent was null");
    parent = document.body;
  }
  awrtc.SLog.SetLogLevel(awrtc.SLogLevel.Info);
  callApp = new CallApp();
  callApp.setupUi(parent);
}
