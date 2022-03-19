import React from "react";
import SpotIconLightPopup from "components/SpotIcon-Light-Popup";
import { Link, Trans, useTranslation } from 'gatsby-plugin-react-i18next';
import Clipboard from 'react-clipboard.js';
import { RichText } from '@graphcms/rich-text-react-renderer';
import { Popup } from "react-leaflet";

const MapSpotPopup = (props) => {

  const {t} = useTranslation();

  return(
    <Popup>
      <SpotIconLightPopup slug={props.spotType.slug} name={props.spotType.name} height='20'/>
      <span class="popup-title">
        <h1>{props.name}</h1>
      </span>
      <RichText content={props.description.raw} />
      <table class="popup-details-table">
        <tr>
          <th><Trans>Potentially Usable By</Trans>:</th>
          <td>
            <ul>
              {props.potentiallyUsableBy
                .map(paddleCraft => {
                  const { name } = paddleCraft;
                  return (
                    <li>{name}</li>
                  )
                })
              }
            </ul>
          </td>
        </tr>
        <tr>
          <th><Trans>GPS</Trans>:</th>
          <td>{props.location.latitude}, {props.location.longitude}</td>
          <td class="clipboard-cell-popup">
            <Clipboard button-class="popup-btn" button-title={t(`Copy GPS to clipboard`)} data-clipboard-text={`${props.location.latitude}, ${props.location.longitude}`}>
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
      </table>
      <button class="popup-btn popup-btn-right">
        <Link to={`/einsteigsorte/${props.slug}`} class="popup-btn-right">
          <Trans>More details</Trans>
        </Link>
      </button>
    </Popup>
  )
}

export default MapSpotPopup;