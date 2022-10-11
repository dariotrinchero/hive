import { ComponentChildren, h, VNode } from "preact";
import { useEffect, useState } from "preact/hooks";

import "@/client/styles/Tabs";

export interface TabsProps {
    tabDefs: {
        title: string,
        content: ComponentChildren;
    }[];
    initial?: number; // initial tab index
    collapseAt?: string;
    noFrame?: boolean;
}

/**
 * Renders collection of tabs with given titles & content. Respects ARIA accessibility
 * guidelines, according to https://gist.github.com/jonathantneal/435478e415bfe4f54d06.
 * 
 * @param props tab definitions, including title & content
 * @returns div containing ul of tabs, followed by a section for each tab content
 */
export default function Tabs(props: TabsProps): VNode {
    const [activeTab, setActiveTab] = useState(props.initial || 0);
    const [collapsed, setCollapsed] = useState<boolean>(); // undefined => collapsing disabled
    const [expanding, setExpanding] = useState(false);

    useEffect(() => {
        if (props.collapseAt) {
            const query = window.matchMedia(`all and (max-width:${props.collapseAt})`);
            const listener = (e: MediaQueryListEvent) => setCollapsed(e.matches || undefined);
            setCollapsed(query.matches || undefined);
            query.addEventListener("change", listener);
            return () => query.removeEventListener("change", listener);
        }
    }, [props.collapseAt]);

    function handleTabClick(index: number): void {
        if (activeTab === index && typeof collapsed !== "undefined"
            && !collapsed) setCollapsed(true);
        else {
            setActiveTab(index);
            if (collapsed) {
                setCollapsed(false);
                setExpanding(true);
            } else setExpanding(false);
        }
    }

    function renderTabHeaders(): VNode[] {
        return props.tabDefs.map((tab, index) => (
            <li
                key={index}
                role="presentation"
                class={`${activeTab === index ? "active-tab" : ""} ${collapsed ? "collapsed" : ""}`}
                onClick={() => handleTabClick(index)}
            >
                <a
                    role="tab"
                    id={`tab-header-${tab.title}`}
                    href={"javascript:void(0);"}
                    aria-controls={`tab-content-${tab.title}`}
                    aria-selected={activeTab === index}
                >
                    {tab.title}
                </a>
            </li>
        ));
    }

    function renderTabContent(): VNode[] {
        return props.tabDefs.map((tab, index) => (
            <section
                key={index}
                role="tabpanel"
                id={`tab-content-${tab.title}`}
                aria-labelledby={`tab-header-${tab.title}`}
                aria-hidden={activeTab !== index}
                aria-expanded={!collapsed}
                class={collapsed ? "collapsed" : expanding ? "expanding" : ""}
                hidden={activeTab !== index}
            >
                <div>
                    {tab.content}
                </div>
            </section>
        ));
    }

    return (
        <div
            class={`tabs ${props.noFrame ? "inner" : ""}`}
        >
            <ul role="tablist">
                {renderTabHeaders()}
            </ul>
            {renderTabContent()}
        </div>
    );
}