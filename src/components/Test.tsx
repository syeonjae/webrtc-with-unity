import React, { useEffect } from "react";
import parse from "html-react-parser";
import { callapp } from "./callapp";
const Test = () => {
  useEffect(() => {
    callapp(document.querySelector("#callapp1") as HTMLElement);
    // const callapp2 = document.querySelector("#callapp1").cloneNode(true);
    // callapp2.id = "callapp2";
    // document.body.appendChild(callapp2);
    // callapp(callapp2);
  }, []);
  return (
    <div>
      {parse(`
            <div id="callapp1" class="grid-container">
                <input type="checkbox" name="audio" class="callapp_send_audio" checked autocomplete="off"> Audio
                <input type="checkbox" name="video" class="callapp_send_video" checked autocomplete="off"> Video
                <select name="video_devices" class="video_devices" >
                </select>
                <input type= "text" class="callapp_address" autocomplete="off">
                <button class="callapp_button"> Join </button>
            <div class="main">
                <div class="callapp_remote_video"></div>
            </div>
        `)}
    </div>
  );
};

export default Test;
