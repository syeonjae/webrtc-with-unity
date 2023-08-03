import React, { useEffect } from "react";
import parse from "html-react-parser";
import { callapp } from "./callapp";
const Test = () => {
  useEffect(() => {
    callapp(document.querySelector("#callapp1") as HTMLElement);
  }, []);
  return (
    <div>
      {parse(`
            <div id="callapp1" class="grid-container">
              <input type= "text" class="callapp_address" autocomplete="off">
              <button class="callapp_button"> Join </button>
              <div class="main">
                  <div class="callapp_remote_video"></div>
              </div>
            </div>
        `)}
    </div>
  );
};

export default Test;
