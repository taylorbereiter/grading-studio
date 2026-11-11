/* ================= Planner: a plain slide template, built in =================
   A .pptx download fills a PowerPoint template: its slide size, its master and its three layouts (Title Slide, Title and
   Content, Title Only). A teacher's own template comes with their setup file. Everyone else gets this one: white, 16:9,
   Calibri-or-similar text, title above and text below where the looks draw their rule. Made here from text, so nothing
   is fetched and nothing of any school's is in it. */
const PT_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const PT_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const PT_U = 9525;   // one slide unit (1280 x 720) in PowerPoint's own units
const ptXfrm = (x, y, w, h) => '<a:xfrm><a:off x="' + x * PT_U + '" y="' + y * PT_U + '"/><a:ext cx="' + w * PT_U + '" cy="' + h * PT_U + '"/></a:xfrm>';
const ptSp = (id, name, ph, box, body, anchor) => '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="' + name + '"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>' + ph + '</p:nvPr></p:nvSpPr><p:spPr>' + (box ? ptXfrm(...box) : '') + '</p:spPr><p:txBody><a:bodyPr' + (anchor ? ' anchor="' + anchor + '"' : '') + '><a:normAutofit/></a:bodyPr><a:lstStyle/>' + body + '</p:txBody></p:sp>';
const ptTree = shapes => '<p:cSld{NAME}><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' + shapes + '</p:spTree></p:cSld>';
const ptP = t => '<a:p><a:r><a:rPr lang="en-US"/><a:t>' + t + '</a:t></a:r></a:p>';
const PT_TITLE = [153, 56, 1009, 124], PT_BODY = [153, 214, 1009, 446];
function plainTplFiles() {
  const lvl = (n, mar, sz) => '<a:lvl' + n + 'pPr marL="' + mar + '" indent="' + (n === 1 ? -342900 : -285750) + '" algn="l" rtl="0"><a:lnSpc><a:spcPct val="100000"/></a:lnSpc><a:spcBef><a:spcPts val="1000"/></a:spcBef><a:buFont typeface="Arial"/><a:buChar char="&#8226;"/><a:defRPr sz="' + sz + '" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl' + n + 'pPr>';
  const master = PT_HEAD + '<p:sldMaster ' + PT_NS + '>' + ptTree(
    ptSp(2, 'Title Placeholder 1', '<p:ph type="title"/>', PT_TITLE, ptP('Click to edit the title'), 'b') +
    ptSp(3, 'Text Placeholder 2', '<p:ph type="body" idx="1"/>', PT_BODY, ptP('Click to edit the text'))).replace('{NAME}', '').replace('<p:spTree>', '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>') +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/><p:sldLayoutId id="2147483650" r:id="rId2"/><p:sldLayoutId id="2147483651" r:id="rId3"/></p:sldLayoutIdLst>' +
    '<p:txStyles><p:titleStyle><a:lvl1pPr algn="l" rtl="0"><a:lnSpc><a:spcPct val="90000"/></a:lnSpc><a:spcBef><a:spcPct val="0"/></a:spcBef><a:buNone/><a:defRPr sz="4000" b="1" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/><a:ea typeface="+mj-ea"/><a:cs typeface="+mj-cs"/></a:defRPr></a:lvl1pPr></p:titleStyle>' +
    '<p:bodyStyle>' + lvl(1, 342900, 3200) + lvl(2, 800100, 2800) + lvl(3, 1257300, 2800) + '</p:bodyStyle>' +
    '<p:otherStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:otherStyle></p:txStyles></p:sldMaster>';
  const layout = (name, type, shapes) => PT_HEAD + '<p:sldLayout ' + PT_NS + (type ? ' type="' + type + '"' : '') + ' preserve="1">' + ptTree(shapes).replace('{NAME}', ' name="' + name + '"') + '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';
  const center = '<a:lstStyle><a:lvl1pPr marL="0" indent="0" algn="ctr"><a:buNone/></a:lvl1pPr></a:lstStyle>';
  const layTitle = layout('Title Slide', 'title',
    ptSp(2, 'Title 1', '<p:ph type="ctrTitle"/>', [254, 150, 907, 206], ptP('Click to edit the title'), 'b').replace('<a:lstStyle/>', '<a:lstStyle><a:lvl1pPr algn="ctr"><a:defRPr sz="5400"/></a:lvl1pPr></a:lstStyle>') +
    ptSp(3, 'Subtitle 2', '<p:ph type="subTitle" idx="1"/>', [254, 388, 907, 170], ptP('Click to edit the subtitle')).replace('<a:lstStyle/>', center));
  const layContent = layout('Title and Content', 'obj', ptSp(2, 'Title 1', '<p:ph type="title"/>', null, ptP('Click to edit the title')) + ptSp(3, 'Content Placeholder 2', '<p:ph idx="1"/>', null, ptP('Click to edit the text')));
  const layOnly = layout('Title Only', 'titleOnly', ptSp(2, 'Title 1', '<p:ph type="title"/>', null, ptP('Click to edit the title')));
  const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>', line = w => '<a:ln w="' + w + '" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>';
  const clr = (n, v) => '<a:' + n + '><a:srgbClr val="' + v + '"/></a:' + n + '>', font = n => '<a:' + n + 'Font><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:' + n + 'Font>';
  const theme = PT_HEAD + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Plain"><a:themeElements><a:clrScheme name="Plain">' +
    clr('dk1', '000000') + clr('lt1', 'FFFFFF') + clr('dk2', '1F3A5F') + clr('lt2', 'EEF0F3') + clr('accent1', '1F6FB2') + clr('accent2', '7B3FC4') + clr('accent3', '0E7C86') + clr('accent4', 'A8327E') + clr('accent5', '3D4CB8') + clr('accent6', '9A5B13') + clr('hlink', '1F6FB2') + clr('folHlink', '7B3FC4') +
    '</a:clrScheme><a:fontScheme name="Plain">' + font('major') + font('minor') + '</a:fontScheme><a:fmtScheme name="Plain"><a:fillStyleLst>' + fill + fill + fill + '</a:fillStyleLst><a:lnStyleLst>' + line(6350) + line(12700) + line(19050) + '</a:lnStyleLst>' +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>' + fill + fill + fill + '</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>';
  const rels = list => PT_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + list.map(([id, type, target]) => '<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/' + type + '" Target="' + target + '"/>').join('') + '</Relationships>';
  const CT = 'application/vnd.openxmlformats-officedocument.';
  return {
    '[Content_Types].xml': PT_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/ppt/presentation.xml" ContentType="' + CT + 'presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="' + CT + 'presentationml.slideMaster+xml"/>' +
      [1, 2, 3].map(n => '<Override PartName="/ppt/slideLayouts/slideLayout' + n + '.xml" ContentType="' + CT + 'presentationml.slideLayout+xml"/>').join('') +
      '<Override PartName="/ppt/theme/theme1.xml" ContentType="' + CT + 'theme+xml"/><Override PartName="/docProps/app.xml" ContentType="' + CT + 'extended-properties+xml"/></Types>',
    '_rels/.rels': rels([['rId1', 'officeDocument', 'ppt/presentation.xml'], ['rId2', 'extended-properties', 'docProps/app.xml']]),
    'docProps/app.xml': PT_HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office PowerPoint</Application><Slides>0</Slides></Properties>',
    'ppt/presentation.xml': PT_HEAD + '<p:presentation ' + PT_NS + '><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>',
    'ppt/_rels/presentation.xml.rels': rels([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rId2', 'theme', 'theme/theme1.xml']]),
    'ppt/slideMasters/slideMaster1.xml': master,
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'slideLayout', '../slideLayouts/slideLayout2.xml'], ['rId3', 'slideLayout', '../slideLayouts/slideLayout3.xml'], ['rId4', 'theme', '../theme/theme1.xml']]),
    'ppt/slideLayouts/slideLayout1.xml': layTitle, 'ppt/slideLayouts/slideLayout2.xml': layContent, 'ppt/slideLayouts/slideLayout3.xml': layOnly,
    ...Object.fromEntries([1, 2, 3].map(n => ['ppt/slideLayouts/_rels/slideLayout' + n + '.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])])),
    'ppt/theme/theme1.xml': theme,
  };
}
// The template a download fills: the teacher's own, or the plain one. As bytes of a .pptx.
let plainTplBytes = null;
function tplBytes() {
  if (L.setup && L.setup.template) return b64ToU8(L.setup.template);
  if (!plainTplBytes) { const te = new TextEncoder(), z = {}; for (const [k, v] of Object.entries(plainTplFiles())) z[k] = te.encode(v); plainTplBytes = fflate.zipSync(z); }
  return plainTplBytes;
}
const ownTpl = () => !!(L.setup && L.setup.template);
