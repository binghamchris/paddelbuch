import React from "react";
import { Link } from "gatsby";
import { graphql, useStaticQuery } from "gatsby"
import { Navbar, Nav, NavDropdown } from "react-bootstrap"

const Header = () => {
  //const { companyName } = useSiteMetadata();

  const { waterways } = useStaticQuery(graphql`
    query {
      waterways: allGraphCmsWaterway(
        filter: {locale: {eq: en}, showInMenu: {eq: true}}
        sort: {fields: name}
      ) {
        nodes {
          name
          slug
          paddlingEnvironments {
            name
          }
        }
      }
    }
  `)

  return (
    <header>
      <Navbar variant="dark" expand="lg" id="site-navbar">
        {/* <Container> */}
        <Link to="/" className="link-no-style">
          <Navbar.Brand as="span">Swiss Canoe Prototype</Navbar.Brand>
        </Link>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
          <Nav className="mr-auto">
            <Link to="/" className="link-no-style">
              <Nav.Link as="span" eventKey="spots">
                Spots
              </Nav.Link>
            </Link>
          </Nav>
          <NavDropdown title="Lakes" id="nav-dropdown-lakes" className="link-no-style">
            { waterways.nodes
              .filter(waterway => waterway.paddlingEnvironments.name === "Lake")
              .map(waterway => {
                const{name, slug} = waterway;
            
                  return (
                    <NavDropdown.Item>
                      <Link to={`/lakes/${slug}`} className="link-no-style">
                        <Nav.Link as="span">
                          {name}
                        </Nav.Link>
                      </Link>
                    </NavDropdown.Item>
                  )
              })
            }
            <NavDropdown.Item>
              <Link to={`/lakes`} className="link-no-style">
                <Nav.Link as="span">
                  More lakes...
                </Nav.Link>
              </Link>
            </NavDropdown.Item>
          </NavDropdown>

          <NavDropdown title="Rivers" id="nav-dropdown-rivers" className="link-no-style">
            { waterways.nodes
              .filter(waterway => waterway.paddlingEnvironments.name === "River")
              .map(waterway => {
                const{name, slug} = waterway;
                return (
                  <NavDropdown.Item>
                    <Link to={`/rivers/${slug}`} className="link-no-style">
                      <Nav.Link as="span">
                        {name}
                      </Nav.Link>
                    </Link>
                  </NavDropdown.Item>
                )
            })
            }
          </NavDropdown>

          <NavDropdown title="Whitewater" id="nav-dropdown-whitewater" className="link-no-style">
            { waterways.nodes
              .filter(waterway => waterway.paddlingEnvironments.name === "Whitewater")
              .map(waterway => {
                const{name, slug} = waterway;
                return (
                  <NavDropdown.Item>
                    <Link to={`/whitewater/${slug}`} className="link-no-style">
                      <Nav.Link as="span">
                        {name}
                      </Nav.Link>
                    </Link>
                  </NavDropdown.Item>
                )
            })
            }
          </NavDropdown>

          <Nav className="mr-auto">
            <Link to="/about" className="link-no-style">
              <Nav.Link as="span" eventKey="about">
                About
              </Nav.Link>
            </Link>
          </Nav>
        </Navbar.Collapse>
        {/* </Container> */}
      </Navbar>

    </header>
  );
};

export default Header;
