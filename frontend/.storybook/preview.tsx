// .storybook/preview.tsx
import { ReactNode, useState } from "react";
import type { Preview } from "@storybook/react";
import { UserContext, UserContextType } from "../src/context/UserContext";

const preview = ["admin", "user", "client", "visitor"];

const RoleDecorator = (Story: () => ReactNode) => {
  const [role, setRole] = useState("admin");

  const mockUser: UserContextType = {
    user: { id: "demo", email: "demo@yukpomnang.com", role },
    setUser: () => {},
    logout: () => {},
  };

  return (
    <div>
      <div style={{ padding: "10px", background: "#f4f4f4", marginBottom: "8px" }}>
        <label style={{ marginRight: 8 }}>ðŸŽ­ RÃ´le simulÃ© :
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {preview.map((r) => (
            <option key={r} value={r}>
              {r}
            
          ))}
        
      

      <UserContext.Provider value={mockUser}>
        <Story />
      </UserContext.Provider>
    
  );
};

const preview: Preview = {
  decorators: [RoleDecorator],
};

export default preview;


</div>
</div></label>
</select>
</option>
</UserContext>
