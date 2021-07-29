import React from "react";
import PropTypes from "prop-types";
import { Helmet } from "react-helmet";

import "assets/stylesheets/application.scss";

import { Container, Row, Col } from "react-bootstrap";
import Header from "components/Header";
//import Footer from "components/Footer";
 
const Layout = ({ children, pageName }) => {
  let className = "";

  if (pageName) {
    className = `${className} page-${pageName}`;
  }

  return (
    <>
      <Helmet bodyAttributes={{ class: className }}>
        <title>Swiss Paddel Buch</title>
      </Helmet>
      <Container fluid="true" className="px-0 main g-0">
          <Row className="justify-content-center g-0">
            <Col>
              <Header />
            </Col>
          </Row>
          
          <Row className="g-0">
            <Col>
              
              <main>{children}</main>
              
            </Col>
          </Row>
        </Container>
        
    </>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  pageName: PropTypes.string,
};


export default Layout;
