import React from "react";
import SpotIconLightPopup from "components/SpotIcon-Light-Popup";
import { Trans, useTranslation } from '@herob191/gatsby-plugin-react-i18next';
import Clipboard from 'react-clipboard.js';
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';
import { Popup } from "react-leaflet";

const MapRejectedSpotPopup = (props) => {

  const {t} = useTranslation();

  return(
    <Popup key={props.slug}>
      <SpotIconLightPopup slug="rejected" name="rejected" height='20'/>
      <span class="popup-title">
        <h1>{props.name}</h1>
      </span>
      <div dangerouslySetInnerHTML={{ __html: 
        documentToHtmlString(JSON.parse(props.description.raw))
      }} />
      <table class="popup-details-table">
        <tbody>
          <tr>
            <th><Trans>GPS</Trans>:</th>
            <td>{props.location.lat}, {props.location.lon}</td>
            <td class="clipboard-cell-popup">
              <Clipboard button-class="popup-btn" button-title={t(`Copy GPS to clipboard`)} data-clipboard-text={`${props.location.lat}, ${props.location.lon}`}>
                <Trans>Copy</Trans>
              </Clipboard>
            </td>
          </tr>
          <tr>
            <th><Trans>Approx. Address</Trans>:</th>
            <td>{props.approximateAddress}</td>
            <td class="clipboard-cell-popup">
              <Clipboard button-class="popup-btn" button-title={t(`Copy approx. address to clipboard`)} data-clipboard-text={`${props.approximateAddress}`}>
                <Trans>Copy</Trans>
              </Clipboard>
            </td>
          </tr>
        </tbody>
      </table>
    </Popup>
  )
}

export default MapRejectedSpotPopup;