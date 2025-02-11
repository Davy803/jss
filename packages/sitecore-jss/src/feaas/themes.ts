import {
  ComponentRendering,
  HtmlElementRendering,
  LayoutServiceData,
  LayoutServicePageState,
  RouteData,
  getFieldValue,
} from '../layout';
import { HTMLLink } from '../models';
import { SITECORE_EDGE_URL_DEFAULT } from '../constants';

/**
 * Stylesheets revision type
 * 'staged': Editing/Preview mode
 * 'published': Normal mode
 */
type RevisionType = 'staged' | 'published';

/**
 * Pattern for library ids
 * @example -library--foo
 */
const FEAAS_LIBRARY_ID_REGEX = /-library--([^\s]+)/;

export const FEAAS_SERVER_URL_STAGING = 'https://feaasstaging.blob.core.windows.net';
export const FEAAS_SERVER_URL_BETA = 'https://feaasbeta.blob.core.windows.net';
export const FEAAS_SERVER_URL_PROD = 'https://feaas.blob.core.windows.net';

/**
 * Walks through rendering tree and returns list of links of all FEAAS Component Library Stylesheets that are used
 * @param {LayoutServiceData} layoutData Layout service data
 * @param {string} [sitecoreEdgeUrl] Sitecore Edge Platform URL. Default is https://edge-platform.sitecorecloud.io
 * @returns {HTMLLink[]} library stylesheet links
 */
export function getFEAASLibraryStylesheetLinks(
  layoutData: LayoutServiceData,
  sitecoreEdgeUrl = SITECORE_EDGE_URL_DEFAULT
): HTMLLink[] {
  const ids = new Set<string>();

  if (!layoutData.sitecore.route) return [];

  traverseComponent(layoutData.sitecore.route, ids);

  return [...ids].map((id) => ({
    href: getStylesheetUrl(id, layoutData.sitecore.context.pageState, sitecoreEdgeUrl),
    rel: 'stylesheet',
  }));
}

export const getStylesheetUrl = (
  id: string,
  pageState?: LayoutServicePageState,
  sitecoreEdgeUrl = SITECORE_EDGE_URL_DEFAULT
) => {
  const revision: RevisionType =
    pageState && pageState !== LayoutServicePageState.Normal ? 'staged' : 'published';

  let serverUrl = FEAAS_SERVER_URL_PROD;
  if (
    sitecoreEdgeUrl.toLowerCase().includes('edge-platform-dev') ||
    sitecoreEdgeUrl.toLowerCase().includes('edge-platform-qa') ||
    sitecoreEdgeUrl.toLowerCase().includes('edge-platform-staging')
  ) {
    serverUrl = FEAAS_SERVER_URL_STAGING;
  } else if (sitecoreEdgeUrl.toLowerCase().includes('edge-platform-pre-production')) {
    serverUrl = FEAAS_SERVER_URL_BETA;
  }
  return `${serverUrl}/styles/${id}/${revision}.css`;
};

/**
 * Traverse placeholder and components to add library ids
 * @param {Array<ComponentRendering | HtmlElementRendering>} components
 * @param {Set<string>} ids library ids
 */
const traversePlaceholder = (
  components: Array<ComponentRendering | HtmlElementRendering>,
  ids: Set<string>
) => {
  components.map((component) => {
    const rendering = component as ComponentRendering;

    return traverseComponent(rendering, ids);
  });
};

/**
 * Traverse component and children to add library ids
 * @param {RouteData | ComponentRendering | HtmlElementRendering} component component data
 * @param {Set<string>} ids library ids
 */
const traverseComponent = (
  component: RouteData | ComponentRendering | HtmlElementRendering,
  ids: Set<string>
) => {
  let libraryId: string | undefined = undefined;
  if ('params' in component && component.params) {
    // LibraryID in css class name takes precedence over LibraryId attribute
    libraryId =
      component.params.CSSStyles?.match(FEAAS_LIBRARY_ID_REGEX)?.[1] ||
      component.params.LibraryId ||
      undefined;
  }
  // if params are empty we try to fall back to data source or attributes
  if (!libraryId && 'fields' in component && component.fields) {
    libraryId =
      getFieldValue(component.fields, 'CSSStyles', '').match(FEAAS_LIBRARY_ID_REGEX)?.[1] ||
      getFieldValue(component.fields, 'LibraryId', '') ||
      undefined;
  }
  // HTMLRendering its class attribute
  if (!libraryId && 'attributes' in component && typeof component.attributes.class === 'string') {
    libraryId = component.attributes.class.match(FEAAS_LIBRARY_ID_REGEX)?.[1];
  }
  if (libraryId) {
    ids.add(libraryId);
  }

  const placeholders = (component as ComponentRendering).placeholders || {};

  Object.keys(placeholders).forEach((placeholder) => {
    traversePlaceholder(placeholders[placeholder], ids);
  });
};
