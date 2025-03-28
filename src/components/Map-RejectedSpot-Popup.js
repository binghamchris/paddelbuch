import React from "react";
import SpotIconLightPopup from "components/SpotIcon-Light-Popup";
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';
import { Popup } from "react-leaflet";

const MapRejectedSpotPopup = (props) => {

  return(
    <Popup key={props.slug}>
      <SpotIconLightPopup slug="rejected" name="rejected" height='20'/>
      <span class="popup-title">
        <h1>{props.name}</h1>
      </span>
      <div dangerouslySetInnerHTML={{ __html: 
        documentToHtmlString(JSON.parse(props.description.raw))
      }} />
    </Popup>
  )
}

export default MapRejectedSpotPopup;