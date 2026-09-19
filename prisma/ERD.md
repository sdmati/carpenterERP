```mermaid
erDiagram

        OrderStatus {
            PENDING PENDING
IN_PROGRESS IN_PROGRESS
COMPLETED COMPLETED
        }
    


        TaskStatus {
            PENDING PENDING
CUT CUT
DRILLED DRILLED
COMPLETED COMPLETED
        }
    


        Color {
            SONOMA SONOMA
WHITE WHITE
GRAY GRAY
BLACK BLACK
        }
    


        Role {
            SAW_OPERATOR SAW_OPERATOR
DRILL_OPERATOR DRILL_OPERATOR
PACKER PACKER
ADMIN ADMIN
        }
    
  "Material" {
    Int id "🗝️"
    String name 
    Float length 
    Float width 
    Float thickness 
    Color color 
    Int stockQuantity 
    Float stockArea 
    }
  

  "Product" {
    Int id "🗝️"
    String name 
    }
  

  "PartDefinition" {
    Int id "🗝️"
    String name 
    Int quantity 
    Float length 
    Float width 
    Float thickness 
    }
  

  "Machine" {
    Int id "🗝️"
    String name 
    String type 
    }
  

  "ProductionOrder" {
    Int id "🗝️"
    Int quantity 
    Color color 
    OrderStatus status 
    }
  

  "ProductionTask" {
    Int id "🗝️"
    Int quantity 
    TaskStatus status 
    String barcode "❓"
    }
  

  "User" {
    Int id "🗝️"
    String username 
    String password 
    String name 
    Role role 
    Int machineId "❓"
    }
  
    "Material" |o--|| "Color" : "enum:color"
    "PartDefinition" }o--|| "Product" : "product"
    "PartDefinition" }o--|| "Material" : "material"
    "ProductionOrder" |o--|| "Color" : "enum:color"
    "ProductionOrder" |o--|| "OrderStatus" : "enum:status"
    "ProductionOrder" }o--|| "Product" : "product"
    "ProductionTask" |o--|| "TaskStatus" : "enum:status"
    "ProductionTask" }o--|| "ProductionOrder" : "order"
    "ProductionTask" }o--|| "PartDefinition" : "partDefinition"
    "ProductionTask" }o--|o "Machine" : "machine"
    "User" |o--|| "Role" : "enum:role"
```
