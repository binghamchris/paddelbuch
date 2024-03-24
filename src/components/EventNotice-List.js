import React from "react";
import { Trans, I18nextContext, Link } from '@herob191/gatsby-plugin-react-i18next';

const EventNoticeList = (props) => {
  
  const context = React.useContext(I18nextContext);
  const language = context.language

  var endDtFormat = { year: 'numeric', month: 'long', day: 'numeric' };

  if (props.thisWaterwayEventNotices.nodes.length > 0) {
    return (
      <table className="eventnotices-list">
        <tbody>
          <tr>
            <th>
              <Trans>Summary</Trans>
            </th>
            <th>
              <Trans>Approx. End Date</Trans>
            </th>
          </tr>
          { props.thisWaterwayEventNotices.nodes
            .filter(waterwayEventNotice => new Date(waterwayEventNotice.endDate) - new Date() > 0)
            .map(waterwayEventNotice => {
              const { name, slug, endDate } = waterwayEventNotice;

              var endDt
              var endDtRaw = new Date(endDate)

              if ( language === "en" ) {
                endDt = new Intl.DateTimeFormat('en-UK', endDtFormat).format(endDtRaw)
              }
              if ( language === "de" ) {
                endDt = new Intl.DateTimeFormat('de-DE', endDtFormat).format(endDtRaw)
              }

              return (
                <tr key={slug}>
                  <td>
                    <Link to={`/gewaesserereignisse/${slug}`}>
                      {name}
                    </Link>
                  </td>
                  <td>{endDt}</td>
                </tr>
              );
          })}
        </tbody>
      </table>
    );
  }
  else {
    return (
      <div className="eventnotices-list">
        <Trans>There are presently no event notices for this waterway</Trans>
      </div>
    );
  }
}

export default EventNoticeList;