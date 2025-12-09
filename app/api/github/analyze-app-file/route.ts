import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

interface AppDependency {
  id: string;
  name: string;
  publisher: string;
  minVersion: string;
}

interface AppManifest {
  id: string;
  name: string;
  publisher: string;
  version: string;
  dependencies: AppDependency[];
}

// Parsear el XML del NavxManifest.xml
function parseNavxManifest(xmlContent: string): AppManifest | null {
  try {
    // Extraer información del App
    const appMatch = xmlContent.match(/<App\s+([^>]+)>/);
    if (!appMatch) return null;

    const appAttrs = appMatch[1];
    
    const getId = (attrs: string) => {
      const match = attrs.match(/Id="([^"]+)"/);
      return match ? match[1] : "";
    };
    
    const getName = (attrs: string) => {
      const match = attrs.match(/Name="([^"]+)"/);
      return match ? match[1] : "";
    };
    
    const getPublisher = (attrs: string) => {
      const match = attrs.match(/Publisher="([^"]+)"/);
      return match ? match[1] : "";
    };
    
    const getVersion = (attrs: string) => {
      const match = attrs.match(/Version="([^"]+)"/);
      return match ? match[1] : "";
    };

    const manifest: AppManifest = {
      id: getId(appAttrs),
      name: getName(appAttrs),
      publisher: getPublisher(appAttrs),
      version: getVersion(appAttrs),
      dependencies: [],
    };

    // Extraer dependencias
    const dependenciesMatch = xmlContent.match(/<Dependencies>([\s\S]*?)<\/Dependencies>/);
    if (dependenciesMatch) {
      const dependenciesContent = dependenciesMatch[1];
      const dependencyRegex = /<Dependency\s+([^>]+)\/>/g;
      let depMatch;
      
      while ((depMatch = dependencyRegex.exec(dependenciesContent)) !== null) {
        const depAttrs = depMatch[1];
        const minVersionMatch = depAttrs.match(/MinVersion="([^"]+)"/);
        
        manifest.dependencies.push({
          id: getId(depAttrs),
          name: getName(depAttrs),
          publisher: getPublisher(depAttrs),
          minVersion: minVersionMatch ? minVersionMatch[1] : "",
        });
      }
    }

    return manifest;
  } catch (error) {
    console.error("Error parsing NavxManifest.xml:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!file.name.endsWith(".app")) {
      return NextResponse.json(
        { error: "File must be a .app file" },
        { status: 400 }
      );
    }

    // Leer el archivo como ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Descomprimir el archivo .app (es un ZIP)
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(arrayBuffer);

    // Buscar el archivo NavxManifest.xml
    const manifestFile = zipContent.file("NavxManifest.xml");
    
    if (!manifestFile) {
      return NextResponse.json(
        { error: "NavxManifest.xml not found in .app file" },
        { status: 400 }
      );
    }

    // Leer el contenido del manifest
    const manifestContent = await manifestFile.async("string");
    
    // Parsear el manifest
    const manifest = parseNavxManifest(manifestContent);
    
    if (!manifest) {
      return NextResponse.json(
        { error: "Failed to parse NavxManifest.xml" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      fileName: file.name,
      manifest,
    });
  } catch (error) {
    console.error("Error analyzing .app file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze .app file" },
      { status: 500 }
    );
  }
}
