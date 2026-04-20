**SHARE Scope of Project** 

**Purpose:**  
The purpose of this project is to determine possible new indoor shelter locations throughout the city of Seattle (west of Lake Washington). We are looking at locations for smaller shelters (10-30 people), preferably near amenities such as transit and school/daycare locations. We will deliver this information in a website that displays the locations of possible shelters, including resources and the ability for the user to add their own locations and a notes function for each location. This website should be able to be utilized for future uses as well.

**Deliverables:**  
Online smart dashboard map containing

- Possible indoor shelter locations  
- Resources  
  - Food banks  
- Bus stops  
- daycare/schools  
- Ability to   
  - Add locations  
  - Add notes for each location  
  - Add photographs of location

**Resources Being Used:**  
ESRI Products (UW Licence)

- ArcGIS Pro/QGIS  
  - Permission needed for groupwork

**Potential Tech Stack for the Online Map App:**

| Component | Choice | Why |
| :---- | :---- | :---- |
| Mapping library | Leaflet | Open-source, no usage limits, solid community |
| Basemap tiles | OpenStreetMap / Carto / Stadia Maps | All free tier, no API key hassles |
| Frontend framework | React | Component-based, avoids the styling inconsistency issues last year's team had |
| Hosting | Vercel free tier or GitHub Pages | Free, deploys from GitHub, no maintenance |
| Data format | Static GeoJSON files | No database needed, free to host, easy to update |
| Client-side spatial ops | Turf.js | If we need buffers or distance calculations in the browser |
| Desktop GIS analysis | ArcGIS Pro / QGIS | Do the heavy analysis here, export results as GeoJSON for the web app |

**Allocation of Tasks and Responsibilities:**  
With a smaller group like this, we decided to spread all responsibilities equally among ourselves. This allows us all to have input in the tasks so that everyone is able to learn and contribute equally. This is ideal for this project since once we start constructing the map, it will be difficult to find other tasks for members to accomplish, ensuring that everyone is able to add to the map instead of someone needing to wait for someone else to finish their task before beginning.   
This would mean everyone is involved in finding data online, wrangling the data, adding it to the map, deciding where to host the map, what resources are being implemented on the map, and more. In addition having three members in our group makes us able to work on the same task since if there is disagreement, there will always be a tie breaker, reducing time delays from disagreements. 

**Role of Sponsor:**  
The role of our sponsor, SHARE, will be to communicate to the team in a timely manner what data we need to look for and the general idea of how they will use the final deliverable. Data such as the size of indoor space, which amenities are important, and the preferred condition of buildings. Since the final deliverable is a working website, SHARE must communicate who will be interacting with it and how, such as adding information, notes, or photographs to the locations the team finds. The sponsor must also be able to provide feedback on the prototype. After the initial website is built, the sponsor should review the progress and provide feedback on the improvements needed before the final deliverable. 