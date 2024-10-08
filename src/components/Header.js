import React from "react";
import { graphql, useStaticQuery } from "gatsby"
import { Navbar, Nav, NavDropdown } from "react-bootstrap"
import { Link, useI18next, Trans, useTranslation, I18nextContext } from '@herob191/gatsby-plugin-react-i18next';
import { StaticImage } from "gatsby-plugin-image";
import "@fontsource/fredoka";
import "@fontsource/quicksand";

const Header = () => {
  const {t} = useTranslation();

  const {languages, originalPath} = useI18next();
  const context = React.useContext(I18nextContext);

  const language = context.language

  const { waterways, staticPages } = useStaticQuery(graphql`
    query {
      waterways: allContentfulWaterway(
        filter: {showInMenu: {eq: true}}
        sort: {name: ASC}
      ) {
        nodes {
          name
          slug
          node_locale
          paddlingEnvironmentType {
            slug
          }
        }
      }
      staticPages: allContentfulStaticPage(sort: {menuOrder: ASC}) {
        nodes {
          title
          slug
          node_locale
          menu
        }
      }
    }
  `);

  return (
    <header>
      <Navbar variant="dark" expand="lg" id="site-navbar">
        {/* <Container> */}
        
        <Link to="/" className="link-no-style">
          <Navbar.Brand as="span">
            <StaticImage
              src="../assets/images/logo-light.svg"
              alt="The Paddel Buch Logo"
              width={33.75}
              height={33.75}
              className="paddelbuch-logo"
            />
            Paddel Buch
          </Navbar.Brand>
        </Link>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
          <Nav className="mr-auto" >
            <NavDropdown title={t('Lakes')} id="nav-dropdown-lakes" className="link-no-style">
              { waterways.nodes
                .filter(waterway => waterway.paddlingEnvironmentType.slug === "see" && waterway.node_locale === language)
                .map(waterway => {
                  const{name, slug} = waterway;
              
                    return (
                      <NavDropdown.Item key={slug}>
                        <Link to={`/gewaesser/${slug}`} className="link-no-style">
                          <Nav.Link as="span">
                            {name}
                          </Nav.Link>
                        </Link>
                      </NavDropdown.Item>
                    )
                })
              }
              <NavDropdown.Divider />
              <NavDropdown.Item>
                <Link to={`/gewaesser/seen`} className="link-no-style">
                  <Nav.Link as="span">
                    <Trans>More lakes</Trans>...
                  </Nav.Link>
                </Link>
              </NavDropdown.Item>
            </NavDropdown>

            <NavDropdown title={t('Rivers')} id="nav-dropdown-rivers" className="link-no-style">
              { waterways.nodes
                .filter(waterway => waterway.paddlingEnvironmentType.slug === "fluss" && waterway.node_locale === language)
                .map(waterway => {
                  const{name, slug} = waterway;
                  return (
                    <NavDropdown.Item key={slug}>
                      <Link to={`/gewaesser/${slug}`} className="link-no-style">
                        <Nav.Link as="span">
                          {name}
                        </Nav.Link>
                      </Link>
                    </NavDropdown.Item>
                  )
              })
              }
              <NavDropdown.Divider />
              <NavDropdown.Item>
                <Link to={`/gewaesser/fluesse`} className="link-no-style">
                  <Nav.Link as="span">
                    <Trans>More rivers</Trans>...
                  </Nav.Link>
                </Link>
              </NavDropdown.Item>
            </NavDropdown>

            <NavDropdown title={t('Open Data')} id="nav-dropdown-opendata" className="link-no-style">
              {staticPages.nodes
                .filter(staticPage => staticPage.menu === "offene Daten" && staticPage.node_locale === language)
                .map(staticPage => {
                  const{title, slug} = staticPage;
                  return (
                    <NavDropdown.Item key={slug}>
                      <Link to={`/offene-daten/${slug}`} className="link-no-style">
                        <Nav.Link as="span">
                          {title}
                        </Nav.Link>
                      </Link>
                    </NavDropdown.Item>
                  )
              })
              }
              <NavDropdown.Item key="api">
                <Link to={`/offene-daten/api`} className="link-no-style">
                  <Nav.Link as="span">
                    <Trans>Data Download / API</Trans>
                  </Nav.Link>
                </Link>
              </NavDropdown.Item>
            </NavDropdown>

            <NavDropdown title={t('About')} id="nav-dropdown-about" className="link-no-style">
              {staticPages.nodes
                .filter(staticPage => staticPage.menu === "Über" && staticPage.node_locale === language)
                .map(staticPage => {
                  const{title, slug} = staticPage;
                  return (
                    <NavDropdown.Item key={slug}>
                      <Link to={`/ueber/${slug}`} className="link-no-style">
                        <Nav.Link as="span">
                          {title}
                        </Nav.Link>
                      </Link>
                    </NavDropdown.Item>
                  )
              })
              }
            </NavDropdown>

            <NavDropdown.Divider />
            <NavDropdown title={t('Language')} id="nav-dropdown-lang" className="link-no-style languages" align="end">
              {languages.map((lng) => (
                <NavDropdown.Item key={lng}>
                <Link to={originalPath} className="link-no-style" language={lng}>
                  <Nav.Link as="span" eventKey={lng}>
                    {lng}
                  </Nav.Link>
                </Link>
              </NavDropdown.Item>
              ))}
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
        {/* </Container> */}
      </Navbar>

    </header>
  );
};

export default Header;
